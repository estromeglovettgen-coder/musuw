import { describe, expect, it, vi } from "vitest";

import {
  createAuthRuntime,
  type AuthorizationDetails,
  type IdentityClient,
  type SessionStorageLike,
} from "./runtime";

function storage(): SessionStorageLike & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
    values,
  };
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function authorizationDetails(
  clientId = "weknora-client",
): AuthorizationDetails {
  return {
    authorization_id: "authorization_1",
    client: {
      id: clientId,
      logo_uri: "",
      name: "Musuw",
      uri: "https://app.musuw.com",
    },
    redirect_uri: "https://app.musuw.com/api/v1/auth/oidc/callback",
    scope: "openid email profile",
  };
}

function identity(
  overrides: Partial<IdentityClient> = {},
): IdentityClient {
  return {
    exchangeCodeForSession: vi.fn(async () => ({
      data: { session: { access_token: "supabase-access-token" } },
      error: null,
    })),
    getSession: vi.fn(async () => ({
      data: { session: { access_token: "supabase-access-token" } },
      error: null,
    })),
    oauth: {
      approveAuthorization: vi.fn(async () => ({
        data: {
          redirect_url:
            "https://app.musuw.com/api/v1/auth/oidc/callback?code=oidc-code&state=weknora-state",
        },
        error: null,
      })),
      getAuthorizationDetails: vi.fn(async () => ({
        data: authorizationDetails(),
        error: null,
      })),
    },
    signInWithOAuth: vi.fn(async () => ({
      data: { url: "https://identity.example/authorize" },
      error: null,
    })),
    signInWithOtp: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    verifyOtp: vi.fn(async () => ({
      data: { session: { access_token: "supabase-access-token" } },
      error: null,
    })),
    ...overrides,
  };
}

function runtimeFor(
  client: IdentityClient,
  store = storage(),
  assigned = vi.fn(),
  fetch = vi.fn<typeof globalThis.fetch>(async () =>
    response({
      authorization_url:
        "https://identity.example/auth/v1/oauth/authorize?client_id=weknora-client&state=weknora-state",
      success: true,
    }),
  ),
  nativeStore = storage(),
  publicOrigin = "https://app.musuw.com",
) {
  return {
    assigned,
    fetch,
    runtime: createAuthRuntime({
      config: {
        publicOrigin,
        publishableKey: "sb_publishable_key",
        supabaseUrl: "https://identity.example",
        weknoraOAuthClientId: "weknora-client",
      },
      createIdentityClient: () => client,
      fetch,
      location: { assign: assigned, origin: "https://app.musuw.com" },
      nativeStorage: nativeStore,
      nextFlowId: () => "flow_1",
      now: () => 1,
      storage: store,
    }),
    nativeStore,
    store,
  };
}

describe("Supabase to WeKnora authorization continuation", () => {
  it("automatically resumes native OIDC from the start route when Supabase is already signed in", async () => {
    const client = identity();
    const { assigned, fetch, runtime } = runtimeFor(client);

    await expect(
      (runtime as typeof runtime & { resumeStart(): Promise<unknown> }).resumeStart(),
    ).resolves.toEqual({ state: "start_complete" });

    expect(client.getSession).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/auth/oidc/url?"),
      expect.objectContaining({ credentials: "same-origin" }),
    );
    expect(assigned).toHaveBeenLastCalledWith(
      "https://identity.example/auth/v1/oauth/authorize?client_id=weknora-client&state=weknora-state",
    );
  });

  it("takes an already valid native session directly to the same-origin workspace", async () => {
    const client = identity();
    const nativeStore = storage();
    nativeStore.setItem("weknora_token", "native-session-token");
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const url = String(input);
      if (url === "https://app.musuw.com/api/v1/auth/me") {
        return response({ success: true });
      }
      return response({ success: false }, 500);
    });
    const { assigned, runtime } = runtimeFor(client, storage(), vi.fn(), fetch, nativeStore);

    await expect(runtime.resumeStart("/?plan=max&period=yearly")).resolves.toEqual({ state: "start_complete" });

    expect(fetch).toHaveBeenCalledWith(
      "https://app.musuw.com/api/v1/auth/me",
      expect.objectContaining({
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer native-session-token",
        },
      }),
    );
    expect(client.getSession).not.toHaveBeenCalled();
    expect(assigned).toHaveBeenLastCalledWith("https://app.musuw.com/?plan=max&period=yearly");
  });

  it("clears a stale native session before it resumes a valid Supabase session", async () => {
    const client = identity();
    const nativeStore = storage();
    nativeStore.setItem("weknora_token", "stale-native-token");
    nativeStore.setItem("weknora_refresh_token", "stale-refresh-token");
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const url = String(input);
      if (url === "https://app.musuw.com/api/v1/auth/me") {
        return response({ success: false }, 401);
      }
      return response({
        authorization_url:
          "https://identity.example/auth/v1/oauth/authorize?client_id=weknora-client&state=weknora-state",
        success: true,
      });
    });
    const { assigned, runtime } = runtimeFor(client, storage(), vi.fn(), fetch, nativeStore);

    await expect(runtime.resumeStart()).resolves.toEqual({ state: "start_complete" });

    expect(nativeStore.getItem("weknora_token")).toBeNull();
    expect(nativeStore.getItem("weknora_refresh_token")).toBeNull();
    expect(client.getSession).toHaveBeenCalledOnce();
    expect(assigned).toHaveBeenLastCalledWith(
      "https://identity.example/auth/v1/oauth/authorize?client_id=weknora-client&state=weknora-state",
    );
  });

  it("keeps a native session when its validation endpoint is temporarily unavailable", async () => {
    const client = identity();
    const nativeStore = storage();
    nativeStore.setItem("weknora_token", "native-session-token");
    const fetch = vi.fn<typeof globalThis.fetch>(async () => response({ success: false }, 503));
    const { assigned, runtime } = runtimeFor(client, storage(), vi.fn(), fetch, nativeStore);

    await expect(runtime.resumeStart()).resolves.toEqual({
      code: "native_session_unavailable",
      state: "start_error",
    });

    expect(nativeStore.getItem("weknora_token")).toBe("native-session-token");
    expect(client.getSession).not.toHaveBeenCalled();
    expect(assigned).not.toHaveBeenCalled();
  });

  it("keeps a native session when its validation response is malformed", async () => {
    const client = identity();
    const nativeStore = storage();
    nativeStore.setItem("weknora_token", "native-session-token");
    const fetch = vi.fn<typeof globalThis.fetch>(async () => response({ success: false }));
    const { assigned, runtime } = runtimeFor(client, storage(), vi.fn(), fetch, nativeStore);

    await expect(runtime.resumeStart()).resolves.toEqual({
      code: "native_session_unavailable",
      state: "start_error",
    });

    expect(nativeStore.getItem("weknora_token")).toBe("native-session-token");
    expect(client.getSession).not.toHaveBeenCalled();
    expect(assigned).not.toHaveBeenCalled();
  });

  it("uses the current localhost origin for the OIDC callback", async () => {
    const client = identity();
    const assigned = vi.fn();
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      response({
        authorization_url:
          "https://identity.example/auth/v1/oauth/authorize?client_id=weknora-client&state=weknora-state",
        success: true,
      }),
    );
    const runtime = createAuthRuntime({
      config: {
        publicOrigin: "http://localhost:4190",
        publishableKey: "sb_publishable_key",
        supabaseUrl: "https://identity.example",
        weknoraOAuthClientId: "weknora-client",
      },
      createIdentityClient: () => client,
      fetch,
      location: { assign: assigned, origin: "http://localhost:4190" },
      nativeStorage: storage(),
      now: () => 1,
      storage: storage(),
    });

    await expect(runtime.resumeStart()).resolves.toEqual({ state: "start_complete" });

    const requestURL = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(requestURL.origin).toBe("http://localhost:4190");
    expect(requestURL.pathname).toBe("/api/v1/auth/oidc/url");
    expect(requestURL.searchParams.get("redirect_uri")).toBe(
      "http://localhost:4190/api/v1/auth/oidc/callback",
    );
  });

  it("starts only the native WeKnora OIDC endpoint after an ordinary Google login", async () => {
    const client = identity();
    const { assigned, fetch, runtime } = runtimeFor(client);

    await runtime.startGoogle();
    await expect(runtime.completeCallback("?code=google-code&flow=flow_1")).resolves.toEqual({
      state: "identity_complete",
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/auth/oidc/url?"),
      expect.objectContaining({ credentials: "same-origin" }),
    );
    expect(fetch.mock.calls.flat().join(" ")).not.toContain("/v1/auth/exchange");
    expect(assigned).toHaveBeenLastCalledWith(
      "https://identity.example/auth/v1/oauth/authorize?client_id=weknora-client&state=weknora-state",
    );
  });

  it("processes one Google callback exactly once when the browser invokes the route effect twice", async () => {
    const client = identity();
    const { fetch, runtime } = runtimeFor(client);

    await runtime.startGoogle();
    const first = runtime.completeCallback("?code=google-code&flow=flow_1");
    const repeated = runtime.completeCallback("?code=google-code&flow=flow_1");

    await expect(Promise.all([first, repeated])).resolves.toEqual([
      { state: "identity_complete" },
      { state: "identity_complete" },
    ]);
    expect(client.exchangeCodeForSession).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("keeps Supabase's opaque authorization ID while it asks an unsigned-in user to log in", async () => {
    const client = identity({
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    });
    const { runtime, store } = runtimeFor(client);

    await expect(runtime.continueAuthorization("?authorization_id=authorization_1")).resolves.toEqual({
      state: "authorization_login_required",
    });
    expect(store.getItem("musnow.auth.pending-authorization")).toBe(
      JSON.stringify({ authorizationId: "authorization_1", createdAt: 1 }),
    );
  });

  it("resumes a pending WeKnora authorization after Google login without calling the displaced exchange endpoint", async () => {
    const client = identity();
    const { assigned, runtime, store } = runtimeFor(client);
    store.setItem(
      "musnow.auth.pending-authorization",
      JSON.stringify({ authorizationId: "authorization_1", createdAt: 1 }),
    );

    await runtime.startGoogle();
    const completed = await runtime.completeCallback("?code=google-code&flow=flow_1");

    expect(completed).toEqual({ state: "identity_complete" });
    expect(assigned).toHaveBeenLastCalledWith(
      "https://app.musuw.com/oauth/consent?authorization_id=authorization_1",
    );
    expect(client.exchangeCodeForSession).toHaveBeenCalledWith("google-code");
    expect(client.signOut).not.toHaveBeenCalled();
  });

  it("resumes a pending WeKnora authorization after email OTP verification", async () => {
    const client = identity();
    const { assigned, runtime, store } = runtimeFor(client);
    store.setItem(
      "musnow.auth.pending-authorization",
      JSON.stringify({ authorizationId: "authorization_1", createdAt: 1 }),
    );

    const completed = await runtime.verifyEmailOtp("USER@example.com", "123456");

    expect(completed).toEqual({ state: "identity_complete" });
    expect(client.verifyOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      token: "123456",
      type: "email",
    });
    expect(assigned).toHaveBeenCalledWith(
      "https://app.musuw.com/oauth/consent?authorization_id=authorization_1",
    );
  });

  it("approves a local authorization from the production consent origin without local storage", async () => {
    const client = identity({
      oauth: {
        approveAuthorization: vi.fn(async () => ({
          data: {
            redirect_url:
              "http://localhost:4190/api/v1/auth/oidc/callback?code=oidc-code&state=weknora-state",
          },
          error: null,
        })),
        getAuthorizationDetails: vi.fn(async () => ({
          data: {
            ...authorizationDetails(),
            redirect_uri: "http://localhost:4190/api/v1/auth/oidc/callback",
          },
          error: null,
        })),
      },
    });
    const { assigned, runtime } = runtimeFor(
      client,
      storage(),
      vi.fn(),
      undefined,
      storage(),
      "http://localhost:4190",
    );

    await expect(runtime.continueAuthorization("?authorization_id=authorization_1")).resolves.toEqual({
      state: "authorization_complete",
    });

    expect(client.oauth.approveAuthorization).toHaveBeenCalledOnce();
    expect(assigned).toHaveBeenCalledWith(
      "http://localhost:4190/api/v1/auth/oidc/callback?code=oidc-code&state=weknora-state",
    );
  });

  it("accepts the loopback alias registered for a fresh local authorization", async () => {
    const client = identity({
      oauth: {
        approveAuthorization: vi.fn(async () => ({
          data: {
            redirect_url:
              "http://127.0.0.1:4190/api/v1/auth/oidc/callback?code=oidc-code&state=client-state",
          },
          error: null,
        })),
        getAuthorizationDetails: vi.fn(async () => ({
          data: {
            ...authorizationDetails(),
            redirect_uri: "http://127.0.0.1:4190/api/v1/auth/oidc/callback",
          },
          error: null,
        })),
      },
    });
    const assigned = vi.fn();
    const runtime = createAuthRuntime({
      config: {
        publicOrigin: "http://localhost:4190",
        publishableKey: "sb_publishable_key",
        supabaseUrl: "https://identity.example",
        weknoraOAuthClientId: "weknora-client",
      },
      createIdentityClient: () => client,
      location: { assign: assigned, origin: "https://app.musuw.com" },
      nativeStorage: storage(),
      now: () => 1,
      storage: storage(),
    });

    await expect(runtime.continueAuthorization("?authorization_id=authorization_1")).resolves.toEqual({
      state: "authorization_complete",
    });
    expect(assigned).toHaveBeenCalledWith(
      "http://127.0.0.1:4190/api/v1/auth/oidc/callback?code=oidc-code&state=client-state",
    );
  });

  it("trusts the configured staging callback without trusting production or request-host origins", async () => {
    const assigned = vi.fn();
    const client = identity({
      oauth: {
        approveAuthorization: vi.fn(async () => ({
          data: {
            redirect_url:
              "https://staging-app.musuw.com/api/v1/auth/oidc/callback?code=oidc-code&state=client-state",
          },
          error: null,
        })),
        getAuthorizationDetails: vi.fn(async () => ({
          data: {
            ...authorizationDetails(),
            redirect_uri: "https://staging-app.musuw.com/api/v1/auth/oidc/callback",
          },
          error: null,
        })),
      },
    });
    const runtime = createAuthRuntime({
      config: {
        publicOrigin: "https://staging-app.musuw.com",
        publishableKey: "sb_publishable_key",
        supabaseUrl: "https://identity.example",
        weknoraOAuthClientId: "weknora-client",
      },
      createIdentityClient: () => client,
      location: { assign: assigned, origin: "https://request-host.example" },
      nativeStorage: storage(),
      now: () => 1,
      storage: storage(),
    });

    await expect(runtime.continueAuthorization("?authorization_id=authorization_1")).resolves.toEqual({
      state: "authorization_complete",
    });
    expect(assigned).toHaveBeenCalledWith(
      "https://staging-app.musuw.com/api/v1/auth/oidc/callback?code=oidc-code&state=client-state",
    );

    const productionClient = identity({
      oauth: {
        approveAuthorization: vi.fn(async () => ({ data: null, error: null })),
        getAuthorizationDetails: vi.fn(async () => ({
          data: {
            ...authorizationDetails(),
            redirect_uri: "https://app.musuw.com/api/v1/auth/oidc/callback",
          },
          error: null,
        })),
      },
    });
    const productionAssigned = vi.fn();
    const stagingRuntime = createAuthRuntime({
      config: {
        publicOrigin: "https://staging-app.musuw.com",
        publishableKey: "sb_publishable_key",
        supabaseUrl: "https://identity.example",
        weknoraOAuthClientId: "weknora-client",
      },
      createIdentityClient: () => productionClient,
      location: { assign: productionAssigned, origin: "https://request-host.example" },
      nativeStorage: storage(),
      now: () => 1,
      storage: storage(),
    });

    await expect(
      stagingRuntime.continueAuthorization("?authorization_id=authorization_1"),
    ).resolves.toEqual({
      code: "oauth_continuation_invalid",
      state: "authorization_error",
    });
    expect(productionAssigned).not.toHaveBeenCalled();
    expect(productionClient.oauth.approveAuthorization).not.toHaveBeenCalled();
  });

  it("rejects a registered redirect outside the production and local callback allowlist", async () => {
    const client = identity({
      oauth: {
        approveAuthorization: vi.fn(async () => ({ data: null, error: null })),
        getAuthorizationDetails: vi.fn(async () => ({
          data: {
            ...authorizationDetails(),
            redirect_uri: "https://attacker.example/callback",
          },
          error: null,
        })),
      },
    });
    const { assigned, runtime } = runtimeFor(client);

    await expect(runtime.continueAuthorization("?authorization_id=authorization_1")).resolves.toEqual({
      code: "oauth_continuation_invalid",
      state: "authorization_error",
    });
    expect(client.oauth.approveAuthorization).not.toHaveBeenCalled();
    expect(assigned).not.toHaveBeenCalled();
  });

  it("follows Supabase's already-consented redirect only when its callback is trusted", async () => {
    const client = identity({
      oauth: {
        approveAuthorization: vi.fn(async () => ({ data: null, error: null })),
        getAuthorizationDetails: vi.fn(async () => ({
          data: {
            redirect_url:
              "http://127.0.0.1:4190/api/v1/auth/oidc/callback?code=oidc-code&state=client-state",
          },
          error: null,
        })),
      },
    });
    const { assigned, runtime } = runtimeFor(
      client,
      storage(),
      vi.fn(),
      undefined,
      storage(),
      "http://localhost:4190",
    );

    await expect(runtime.continueAuthorization("?authorization_id=authorization_1")).resolves.toEqual({
      state: "authorization_complete",
    });
    expect(client.oauth.approveAuthorization).not.toHaveBeenCalled();
    expect(assigned).toHaveBeenCalledWith(
      "http://127.0.0.1:4190/api/v1/auth/oidc/callback?code=oidc-code&state=client-state",
    );
  });

  it.each([
    ["empty state", "https://app.musuw.com/api/v1/auth/oidc/callback?code=oidc-code&state="],
    ["non-default production port", "https://app.musuw.com:444/api/v1/auth/oidc/callback?code=oidc-code&state=client-state"],
  ])("rejects a server redirect with an unsafe %s", async (_name, redirectURL) => {
    const client = identity({
      oauth: {
        approveAuthorization: vi.fn(async () => ({ data: null, error: null })),
        getAuthorizationDetails: vi.fn(async () => ({
          data: { redirect_url: redirectURL },
          error: null,
        })),
      },
    });
    const { assigned, runtime } = runtimeFor(client);

    await expect(runtime.continueAuthorization("?authorization_id=authorization_1")).resolves.toEqual({
      code: "oauth_continuation_invalid",
      state: "authorization_error",
    });
    expect(assigned).not.toHaveBeenCalled();
  });

  it("approves the configured WeKnora client for an already signed-in user and follows Supabase's redirect_url", async () => {
    const client = identity();
    const { assigned, runtime, store } = runtimeFor(client);
    store.setItem(
      "musnow.auth.weknora-oidc",
      JSON.stringify({
        callbackUrl: "https://app.musuw.com/api/v1/auth/oidc/callback",
        createdAt: 1,
        state: "weknora-state",
      }),
    );

    const result = await runtime.continueAuthorization("?authorization_id=authorization_1");

    expect(result).toEqual({ state: "authorization_complete" });
    expect(client.oauth.getAuthorizationDetails).toHaveBeenCalledWith("authorization_1");
    expect(client.oauth.approveAuthorization).toHaveBeenCalledWith("authorization_1", {
      skipBrowserRedirect: true,
    });
    expect(assigned).toHaveBeenCalledWith(
      "https://app.musuw.com/api/v1/auth/oidc/callback?code=oidc-code&state=weknora-state",
    );
  });

  it("approves one authorization request once when the consent route effect is replayed", async () => {
    const client = identity();
    const { runtime, store } = runtimeFor(client);
    store.setItem(
      "musnow.auth.weknora-oidc",
      JSON.stringify({
        callbackUrl: "https://app.musuw.com/api/v1/auth/oidc/callback",
        createdAt: 1,
        state: "weknora-state",
      }),
    );

    const first = runtime.continueAuthorization("?authorization_id=authorization_1");
    const repeated = runtime.continueAuthorization("?authorization_id=authorization_1");

    await expect(Promise.all([first, repeated])).resolves.toEqual([
      { state: "authorization_complete" },
      { state: "authorization_complete" },
    ]);
    expect(client.oauth.approveAuthorization).toHaveBeenCalledOnce();
  });

  it("rejects an unknown OAuth client before it can receive an authorization code", async () => {
    const client = identity({
      oauth: {
        approveAuthorization: vi.fn(async () => ({ data: null, error: null })),
        getAuthorizationDetails: vi.fn(async () => ({
          data: authorizationDetails("unknown-client"),
          error: null,
        })),
      },
    });
    const { assigned, runtime, store } = runtimeFor(client);
    store.setItem(
      "musnow.auth.weknora-oidc",
      JSON.stringify({
        callbackUrl: "https://app.musuw.com/api/v1/auth/oidc/callback",
        createdAt: 1,
        state: "weknora-state",
      }),
    );

    await expect(runtime.continueAuthorization("?authorization_id=authorization_1")).resolves.toEqual({
      code: "oauth_client_not_allowed",
      state: "authorization_error",
    });
    expect(client.oauth.approveAuthorization).not.toHaveBeenCalled();
    expect(assigned).not.toHaveBeenCalled();
  });

  it("sign-out clears the local Supabase session and every pending continuation", async () => {
    const client = identity();
    const { runtime, store } = runtimeFor(client);
    store.setItem("musnow.supabase.pkce", "session");
    store.setItem("musnow.auth.flow", "flow");
    store.setItem(
      "musnow.auth.pending-authorization",
      JSON.stringify({ authorizationId: "authorization_1", createdAt: 1 }),
    );
    store.setItem("musnow.auth.weknora-oidc", "expected");

    await runtime.signOut();

    expect(client.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(store.values.size).toBe(0);
  });
});
