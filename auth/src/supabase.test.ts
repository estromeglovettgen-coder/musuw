import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAuthStorage, createSupabaseIdentityClient } from "./supabase";
import {
  AUTH_FLOW_TTL_MS,
  type AuthConfig,
  type IdentityClient,
  type SessionStorageLike,
} from "./runtime";

const mocked = vi.hoisted(() => ({
  auth: {
    exchangeCodeForSession: vi.fn(),
    getSession: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    verifyOtp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
  },
  createClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocked.createClient,
}));

function storage(): SessionStorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

function sharedStorage(): SessionStorageLike & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
    values,
  };
}

const config: AuthConfig = {
  publicOrigin: "https://app.musuw.com",
  publishableKey: "sb_publishable_key",
  supabaseUrl: "https://identity.example",
  weknoraOAuthClientId: "weknora-client",
};

async function realSdkFixture() {
  const { createClient } = await vi.importActual<typeof import("@supabase/supabase-js")>(
    "@supabase/supabase-js",
  );
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const user = { id: "00000000-0000-4000-8000-000000000001", aud: "authenticated" };
  const accessToken = (subject: string) => [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify({ sub: subject, exp: expiresAt })).toString("base64url"),
    Buffer.from("synthetic-signature").toString("base64url"),
  ].join(".");
  const session = {
    access_token: accessToken(user.id),
    refresh_token: "synthetic-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    user,
  };
  const secondUser = { ...user, id: "00000000-0000-4000-8000-000000000002" };
  const secondSession = { ...session, access_token: accessToken(secondUser.id), refresh_token: "second-synthetic-refresh", user: secondUser };
  const provider = vi.fn<typeof fetch>(async (input, options) => {
    const url = String(input);
    if (url.endsWith("/token?grant_type=password")) {
      return Response.json(session);
    }
    if (url.endsWith("/user")) {
      return Response.json(new Headers(options?.headers).get("authorization") === `Bearer ${secondSession.access_token}` ? secondUser : user);
    }
    if (url.endsWith("/logout?scope=local")) return new Response(null, { status: 204 });
    throw new Error("Unexpected synthetic provider request");
  });
  mocked.createClient.mockImplementation((url, key, options) =>
    createClient(url, key, { ...options, global: { fetch: provider } }),
  );
  return { provider, session, secondSession };
}

describe("Supabase identity adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.createClient.mockReturnValue({ auth: mocked.auth });
    mocked.auth.getSession.mockResolvedValue({
      data: { session: { access_token: "access-token" } },
      error: null,
    });
  });

  it("maps SDK AuthError codes to bounded password errors without exposing raw details", async () => {
    mocked.auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: {
        code: "invalid_credentials",
        message: "raw provider detail must never cross the auth boundary",
        status: 401,
      },
    });

    const client = createSupabaseIdentityClient(config, storage()) as ReturnType<
      typeof createSupabaseIdentityClient
    > & {
      signInWithPassword(input: { email: string; password: string }): Promise<unknown>;
    };

    await expect(client.signInWithPassword({ email: "user@example.com", password: "secret" })).resolves.toEqual({
      data: { session: null },
      error: { code: "invalid_credentials" },
    });
    expect(mocked.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "secret",
    });
  });

  for (const method of ["details", "approve"] as const) {
    for (const [status, expected] of [
      [503, "unavailable"], [408, "unavailable"], [429, "unavailable"],
      [400, "authorization_invalid"], [401, "authorization_invalid"],
      [403, "authorization_invalid"], [404, "authorization_invalid"],
    ] as const) {
      it(`classifies OAuth ${method} HTTP ${status} without treating invalid authorization as retryable`, async () => {
        const { provider } = await realSdkFixture();
        const client = createSupabaseIdentityClient(config, sharedStorage());
        await client.signInWithPassword({ email: "synthetic@example.test", password: "synthetic-password" });
        provider.mockResolvedValueOnce(Response.json({ code: "synthetic_provider_detail" }, { status }));
        const result = method === "details"
          ? await client.oauth.getAuthorizationDetails("authorization_1")
          : await client.oauth.approveAuthorization("authorization_1", { skipBrowserRedirect: true });
        expect(result).toEqual({ data: null, error: { code: expected } });
      });
    }
    it(`keeps an OAuth ${method} network failure retryable through the actual SDK`, async () => {
      const { provider } = await realSdkFixture();
      const client = createSupabaseIdentityClient(config, sharedStorage());
      await client.signInWithPassword({ email: "synthetic@example.test", password: "synthetic-password" });
      provider.mockRejectedValueOnce(new TypeError("Synthetic offline"));
      const result = method === "details"
        ? await client.oauth.getAuthorizationDetails("authorization_1")
        : await client.oauth.approveAuthorization("authorization_1", { skipBrowserRedirect: true });
      expect(result).toEqual({ data: null, error: { code: "unavailable" } });
    });
  }

  it("revokes the current SDK session before clearing shared and legacy tab sessions", async () => {
    const { provider, session } = await realSdkFixture();
    const shared = sharedStorage();
    const legacyTab = storage();
    legacyTab.setItem("musnow.supabase.pkce", '{"access_token":"old-tab-token"}');
    shared.setItem("musuw.theme", "dark");
    const client = createSupabaseIdentityClient(config, shared, legacyTab);
    await client.signInWithPassword({ email: "synthetic@example.test", password: "synthetic-password" });

    await expect(client.signOut({ scope: "local" })).resolves.toEqual({ error: null });

    const logout = provider.mock.calls.find(([input]) => String(input).endsWith("/logout?scope=local"));
    expect(logout).toBeDefined();
    expect(new Headers(logout?.[1]?.headers).get("authorization")).toBe(`Bearer ${session.access_token}`);
    expect(shared.getItem("musnow.supabase.pkce")).toBeNull();
    expect(legacyTab.getItem("musnow.supabase.pkce")).toBeNull();
    expect(shared.getItem("musuw.theme")).toBe("dark");
  });

  it("restores the same identity in a second client without migrating or preferring old tab tokens", async () => {
    const { provider, session } = await realSdkFixture();
    const shared = sharedStorage();
    const firstTab = storage();
    const secondTab = storage();
    secondTab.setItem("musnow.supabase.pkce", JSON.stringify({ ...session, access_token: "old-tab-token" }));
    firstTab.setItem("musnow.auth.flow", "first-tab-only");
    const first = createSupabaseIdentityClient(config, shared, firstTab);
    await first.signInWithPassword({ email: "synthetic@example.test", password: "synthetic-password" });
    const second = createSupabaseIdentityClient(config, shared, secondTab);

    await expect(second.getSession()).resolves.toEqual({
      data: { session: { access_token: session.access_token } }, error: null,
    });
    expect(provider).toHaveBeenCalledTimes(1);
    expect(shared.getItem("musnow.auth.flow")).toBeNull();
    expect(secondTab.getItem("musnow.auth.flow")).toBeNull();

    shared.removeItem("musnow.supabase.pkce");
    const afterSharedLogout = createSupabaseIdentityClient(config, shared, secondTab);
    await expect(afterSharedLogout.getSession()).resolves.toEqual({ data: { session: null }, error: null });
    expect(shared.getItem("musnow.supabase.pkce")).toBeNull();
    expect(secondTab.getItem("musnow.supabase.pkce")).toContain("old-tab-token");
  });

  it("clears both session media after provider logout fails and cannot restore a stale identity", async () => {
    const { provider } = await realSdkFixture();
    const shared = sharedStorage();
    const legacyTab = storage();
    const client = createSupabaseIdentityClient(config, shared, legacyTab);
    await client.signInWithPassword({ email: "synthetic@example.test", password: "synthetic-password" });
    legacyTab.setItem("musnow.supabase.pkce", '{"access_token":"old-tab-token"}');
    provider.mockResolvedValueOnce(Response.json({ code: "unexpected_failure", message: "synthetic failure" }, { status: 500 }));

    await expect(client.signOut({ scope: "local" })).resolves.toEqual({ error: { code: "unavailable" } });
    expect(shared.getItem("musnow.supabase.pkce")).toBeNull();
    expect(legacyTab.getItem("musnow.supabase.pkce")).toBeNull();
    await expect(createSupabaseIdentityClient(config, shared, legacyTab).getSession()).resolves.toEqual({
      data: { session: null }, error: null,
    });
  });

  it("cannot clear a newly signed-in account when an older logout finishes later", async () => {
    const { provider, session, secondSession } = await realSdkFixture();
    const shared = sharedStorage();
    const first = createSupabaseIdentityClient(config, shared, storage());
    await first.signInWithPassword({ email: "synthetic@example.test", password: "synthetic-password" });
    let release!: () => void;
    let started!: () => void;
    const inFlight = new Promise<void>(resolve => { started = resolve; });
    const hold = new Promise<void>(resolve => { release = resolve; });
    provider.mockImplementationOnce(async () => { started(); await hold; return new Response(null, { status: 204 }); });
    const pending = first.signOut({ scope: "local" });
    await inFlight;
    const second = createSupabaseIdentityClient(config, shared, storage());
    provider.mockResolvedValueOnce(Response.json(secondSession));
    await second.signInWithPassword({ email: "second@example.test", password: "synthetic-password" });
    release();

    await expect(pending).resolves.toEqual({ error: null });
    await expect(second.getSession()).resolves.toEqual({ data: { session: { access_token: secondSession.access_token } }, error: null });
    const logout = provider.mock.calls.find(([input]) => String(input).endsWith("/logout?scope=local"));
    expect(new Headers(logout?.[1]?.headers).get("authorization")).toBe(`Bearer ${session.access_token}`);
  });

  it("surfaces blocked shared storage instead of silently using the old tab identity", async () => {
    const { provider, session } = await realSdkFixture();
    const legacyTab = storage();
    legacyTab.setItem("musnow.supabase.pkce", JSON.stringify(session));
    const blocked: SessionStorageLike = {
      getItem() { throw new Error("shared storage unavailable"); },
      setItem() { throw new Error("shared storage unavailable"); },
      removeItem() { throw new Error("shared storage unavailable"); },
    };
    expect(() => createSupabaseIdentityClient(config, blocked, legacyTab)).toThrow("shared storage unavailable");
    expect(provider).not.toHaveBeenCalled();
    expect(legacyTab.getItem("musnow.supabase.pkce")).toContain(session.access_token);
  });

  it("reports persistence failure after provider sign-in without falling back to tab storage", async () => {
    await realSdkFixture();
    const legacyTab = storage();
    const readOnlyShared: SessionStorageLike = {
      getItem() { return null; },
      setItem() { throw new Error("shared storage write unavailable"); },
      removeItem() {},
    };
    const client = createSupabaseIdentityClient(config, readOnlyShared, legacyTab);
    await expect(client.signInWithPassword({ email: "synthetic@example.test", password: "synthetic-password" }))
      .rejects.toThrow("shared storage write unavailable");
    expect(legacyTab.getItem("musnow.supabase.pkce")).toBeNull();
    await expect(client.getSession()).resolves.toEqual({ data: { session: null }, error: null });
  });

  it("rejects a password update if the shared account switched before submission", async () => {
    const { provider, session, secondSession } = await realSdkFixture();
    const shared = sharedStorage();
    const client = createSupabaseIdentityClient(config, shared);
    await client.signInWithPassword({ email: "synthetic@example.test", password: "synthetic-password" });
    shared.setItem("musnow.supabase.pkce", JSON.stringify(secondSession));

    await expect(client.updateUser({ password: "changed-password" }, { expectedAccessToken: session.access_token }))
      .resolves.toEqual({ data: { session: null }, error: { code: "unavailable" } });
    expect(provider.mock.calls.filter(([, options]) => options?.method === "PUT")).toHaveLength(0);
    expect(JSON.parse(shared.getItem("musnow.supabase.pkce")!).access_token).toBe(secondSession.access_token);
  });

  it("pins the password request bearer and cannot overwrite an account switch while the request is in flight", async () => {
    const { provider, session, secondSession } = await realSdkFixture();
    const shared = sharedStorage();
    const client = createSupabaseIdentityClient(config, shared);
    await client.signInWithPassword({ email: "synthetic@example.test", password: "synthetic-password" });
    let release!: () => void;
    let started!: () => void;
    const inFlight = new Promise<void>(resolve => { started = resolve; });
    const hold = new Promise<void>(resolve => { release = resolve; });
    const respond = provider.getMockImplementation()!;
    provider.mockImplementation(async (input, options) => {
      if (options?.method === "PUT") { started(); await hold; }
      return respond(input, options);
    });
    const pending = client.updateUser({ password: "changed-password" }, { expectedAccessToken: session.access_token });
    await inFlight;
    shared.setItem("musnow.supabase.pkce", JSON.stringify(secondSession));
    release();

    await expect(pending).resolves.toEqual({ data: { session: null }, error: { code: "unavailable" } });
    const request = provider.mock.calls.find(([, options]) => options?.method === "PUT");
    expect(new Headers(request?.[1]?.headers).get("authorization")).toBe(`Bearer ${session.access_token}`);
    expect(JSON.parse(shared.getItem("musnow.supabase.pkce")!).access_token).toBe(secondSession.access_token);
  });

  it("updates a bound recovery identity through the SDK without persisting its isolated session", async () => {
    const { session, provider } = await realSdkFixture();
    const shared = sharedStorage();
    const client = createSupabaseIdentityClient(config, shared);
    await client.signInWithPassword({ email: "synthetic@example.test", password: "synthetic-password" });
    const before = shared.getItem("musnow.supabase.pkce");

    await expect(client.updateUser({ password: "changed-password" }, { expectedAccessToken: session.access_token }))
      .resolves.toEqual({ data: { session: { access_token: session.access_token } }, error: null });
    expect(shared.getItem("musnow.supabase.pkce")).toBe(before);
    const request = provider.mock.calls.find(([, options]) => options?.method === "PUT");
    expect(new Headers(request?.[1]?.headers).get("authorization")).toBe(`Bearer ${session.access_token}`);
    expect(JSON.parse(String(request?.[1]?.body)).password).toBe("changed-password");
  });

  it("rejects missing or expired recovery sessions before creating a password request", async () => {
    const client = createSupabaseIdentityClient(config, storage());
    const binding = { expectedAccessToken: "access-token" };
    for (const session of [null, { access_token: "access-token", refresh_token: "synthetic-refresh", expires_at: 1 }]) {
      mocked.auth.getSession.mockResolvedValue({ data: { session }, error: null });
      await expect(client.updateUser({ password: "changed-password" }, binding))
        .resolves.toEqual({ data: { session: null }, error: { code: "unavailable" } });
    }
    await expect(client.updateUser({ password: "changed-password" }, { expectedAccessToken: "" }))
      .resolves.toEqual({ data: { session: null }, error: { code: "unavailable" } });
    expect(mocked.auth.updateUser).not.toHaveBeenCalled();
  });

  it("keeps existing-account signup errors bounded without exposing account existence to UI", async () => {
    mocked.auth.signUp.mockResolvedValue({
      data: { session: null },
      error: { code: "email_exists", message: "provider detail", status: 422 },
    });
    const client = createSupabaseIdentityClient(config, storage());
    await expect(
      client.signUp({ email: "user@example.com", password: "secret-password" }),
    ).resolves.toEqual({ data: { session: null }, error: { code: "identity_exists" } });
  });

  it("collapses provider confirmation status into the generic credential error", async () => {
    mocked.auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { code: "email_not_confirmed", message: "provider detail", status: 400 },
    });
    const client = createSupabaseIdentityClient(config, storage());
    await expect(
      client.signInWithPassword({ email: "user@example.com", password: "secret-password" }),
    ).resolves.toEqual({ data: { session: null }, error: { code: "invalid_credentials" } });
  });

  it("verifies signup tokens through Supabase and keeps provider errors bounded", async () => {
    mocked.auth.verifyOtp.mockResolvedValueOnce({
      data: { session: { access_token: "access-token", refresh_token: "secret-refresh-token" } },
      error: null,
    });
    const client = createSupabaseIdentityClient(config, storage());
    const signupVerification = {
      email: "user@example.com",
      token: "123456",
      type: "signup",
    } satisfies Parameters<IdentityClient["verifyOtp"]>[0];

    await expect(client.verifyOtp(signupVerification)).resolves.toEqual({
      data: { session: { access_token: "access-token" } },
      error: null,
    });
    expect(mocked.auth.verifyOtp).toHaveBeenCalledWith(signupVerification);

    mocked.auth.verifyOtp.mockResolvedValueOnce({
      data: { session: null },
      error: {
        code: "over_email_send_rate_limit",
        message: "raw provider detail must never cross the auth boundary",
        status: 429,
      },
    });
    await expect(client.verifyOtp(signupVerification)).resolves.toEqual({
      data: { session: null },
      error: { code: "rate_limited" },
    });
  });

  it("uses appendable SDK flow ids and passes a validated flow id to exchange", async () => {
    mocked.auth.exchangeCodeForSession.mockResolvedValue({
      data: { session: { access_token: "access-token" } },
      error: null,
    });
    const client = createSupabaseIdentityClient(config, storage(), sharedStorage());
    await expect(
      client.exchangeCodeForSession("auth-code", { flowId: "0123456789abcdef0123456789abcdef" }),
    ).resolves.toEqual({ data: { session: { access_token: "access-token" } }, error: null });
    expect(mocked.auth.exchangeCodeForSession).toHaveBeenCalledWith("auth-code", {
      flowId: "0123456789abcdef0123456789abcdef",
    });
    expect(mocked.createClient).toHaveBeenCalledWith(
      config.supabaseUrl,
      config.publishableKey,
      expect.objectContaining({
        auth: expect.objectContaining({
          experimental: { appendPkceFlowIdToRedirects: true },
        }),
      }),
    );
  });

  it("projects only an access token and exact public redirect options for signup and recovery", async () => {
    mocked.auth.signUp.mockResolvedValue({
      data: { session: { access_token: "access-token", refresh_token: "secret-refresh-token" } },
      error: null,
    });
    mocked.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    const client = createSupabaseIdentityClient(config, storage()) as ReturnType<
      typeof createSupabaseIdentityClient
    > & {
      signUp(input: unknown): Promise<unknown>;
      resetPasswordForEmail(email: string, options: unknown): Promise<unknown>;
    };

    await expect(
      client.signUp({
        email: "user@example.com",
        password: "secret",
        options: { emailRedirectTo: "https://app.musuw.com/auth/callback?flow=signup" },
      }),
    ).resolves.toEqual({
      data: { session: { access_token: "access-token" } },
      error: null,
    });
    await expect(
      client.resetPasswordForEmail("user@example.com", {
        redirectTo: "https://app.musuw.com/auth/callback?flow=recovery",
      }),
    ).resolves.toEqual({ error: null });
    expect(mocked.auth.resetPasswordForEmail).toHaveBeenCalledWith("user@example.com", {
      redirectTo: "https://app.musuw.com/auth/callback?flow=recovery",
    });
  });

  it("shares only short-lived PKCE verifier slots and the opaque auth flow across tabs", () => {
    const firstTab = storage();
    const secondTab = storage();
    const shared = sharedStorage();
    const firstAuthStorage = createAuthStorage(firstTab, shared);
    const secondAuthStorage = createAuthStorage(secondTab, shared);

    firstAuthStorage.setItem("musnow.supabase.pkce-code-verifier", "verifier");
    firstAuthStorage.setItem(
      "musnow.supabase.pkce-flow-0123456789abcdef0123456789abcdef-code-verifier",
      "slot-verifier",
    );
    firstAuthStorage.setItem("musnow.auth.flow", '{"id":"flow_1","kind":"recovery"}');
    firstAuthStorage.setItem("musnow.supabase.pkce", '{"access_token":"session"}');

    expect(secondAuthStorage.getItem("musnow.supabase.pkce-code-verifier")).toBe("verifier");
    expect(
      secondAuthStorage.getItem(
        "musnow.supabase.pkce-flow-0123456789abcdef0123456789abcdef-code-verifier",
      ),
    ).toBe(
      "slot-verifier",
    );
    expect(secondAuthStorage.getItem("musnow.auth.flow")).toBeNull();
    expect(secondAuthStorage.getItem("musnow.supabase.pkce")).toBeNull();

    secondAuthStorage.removeItem("musnow.supabase.pkce-code-verifier");
    secondAuthStorage.removeItem(
      "musnow.supabase.pkce-flow-0123456789abcdef0123456789abcdef-code-verifier",
    );
    expect(firstAuthStorage.getItem("musnow.supabase.pkce-code-verifier")).toBeNull();
    expect(firstAuthStorage.getItem("musnow.auth.flow")).toContain('"kind":"recovery"');
  });

  it("expires verifier envelopes and never routes session tokens or passwords to shared storage", () => {
    let now = 100;
    const firstTab = storage();
    const shared = sharedStorage();
    const authStorage = createAuthStorage(firstTab, shared, () => now);
    authStorage.setItem("musnow.supabase.pkce-code-verifier", "verifier");
    authStorage.setItem("musnow.supabase.pkce", '{"access_token":"session","refresh_token":"refresh"}');
    authStorage.setItem("musnow.auth.flow", '{"kind":"signup"}');
    expect(shared.values.has("musnow.supabase.pkce-code-verifier")).toBe(true);
    expect(shared.values.has("musnow.supabase.pkce")).toBe(false);
    expect(shared.values.has("musnow.auth.flow")).toBe(false);
    now += AUTH_FLOW_TTL_MS + 1;
    expect(authStorage.getItem("musnow.supabase.pkce-code-verifier")).toBeNull();
    expect(shared.values.has("musnow.supabase.pkce-code-verifier")).toBe(false);
  });
});
