import { beforeEach, describe, expect, it, vi } from "vitest";
import worker from "./index";

type WorkerEnv = Parameters<typeof worker.fetch>[1];

function env(assetFetch: (request: Request) => Promise<Response>): WorkerEnv {
  return {
    ASSETS: { fetch: vi.fn(assetFetch) },
    ORIGIN_APP_URL: "https://origin-app.musuw.com",
  } as unknown as WorkerEnv;
}

function assetRouter(): (request: Request) => Promise<Response> {
  return async (request) => {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/index.html") return new Response("product shell", { headers: { "Content-Type": "text/html" } });
    if (pathname === "/auth/index.html") return new Response("auth shell", { headers: { "Content-Type": "text/html" } });
    if (pathname === "/embed.html") return new Response("embed shell", { headers: { "Content-Type": "text/html" } });
    if (pathname === "/assets/app-abc.js") return new Response("asset", { headers: { "Content-Type": "text/javascript" } });
    if (pathname === "/auth/assets/auth-abc.js") return new Response("auth asset", { headers: { "Content-Type": "text/javascript" } });
    if (pathname === "/weknora-widget.js") return new Response("widget", { headers: { "Content-Type": "text/javascript" } });
    return new Response("not found", { status: 404 });
  };
}

describe("musuw app edge routing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it.each(["/api/v1/chat/completions?stream=1", "/files", "/r/resource-token", "/health"])(
    "proxies %s without changing the response stream",
    async (path) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("event: chunk\n\n"));
          controller.close();
        },
      });
      const upstream = new Response(body, {
        status: 201,
        headers: [
          ["Content-Type", "text/event-stream"],
          ["Set-Cookie", "first=one; Path=/; HttpOnly"],
          ["Set-Cookie", "second=two; Path=/; HttpOnly"],
          ["Location", "/auth/complete?state=opaque"],
          ["Content-Security-Policy", "default-src 'self'"],
        ],
      });
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(upstream);
      const request = new Request(`https://staging.musuw.workers.dev${path}`, {
        headers: {
          Cookie: "session=opaque",
          "Content-Type": "application/json",
          "CF-Connecting-IP": "203.0.113.10",
        },
      });
      Object.defineProperty(request, "cf", { value: { colo: "PHX" } });

      const response = await worker.fetch(request, env(assetRouter()));
      const sent = fetchSpy.mock.calls[0]?.[0];
      expect(sent).toBeInstanceOf(Request);
      const sentRequest = sent as Request;
      expect(new URL(sentRequest.url).hostname).toBe("origin-app.musuw.com");
      expect(new URL(sentRequest.url).pathname).toBe(new URL(request.url).pathname);
      expect(sentRequest.headers.get("cookie")).toBe("session=opaque");
      expect(sentRequest.headers.get("x-forwarded-host")).toBe("staging.musuw.workers.dev");
      expect(sentRequest.headers.get("x-forwarded-proto")).toBe("https");
      expect(sentRequest.headers.get("x-forwarded-for")).toBe("203.0.113.10");
      expect(response.status).toBe(201);
      expect(response.body).toBe(upstream.body);
      expect(response.headers.get("content-type")).toBe("text/event-stream");
      expect(response.headers.get("set-cookie")).toContain("first=one");
      expect(response.headers.get("set-cookie")).toContain("second=two");
      expect(response.headers.get("location")).toBe("/auth/complete?state=opaque");
      expect(response.headers.get("content-security-policy")).toBe("default-src 'self'");
      expect(fetchSpy.mock.calls[0]?.[1]).toEqual({ redirect: "manual" });
    },
  );

  it("forwards a streaming upload body without reading it in the Worker", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const request = input as Request;
      expect(await request.text()).toBe("large-file-chunk");
      return new Response("uploaded", { status: 201 });
    });
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("large-file-chunk"));
        controller.close();
      },
    });
    const request = new Request("https://staging.musuw.workers.dev/api/v1/files", {
      method: "POST",
      body,
      headers: { Cookie: "session=opaque" },
      ...({ duplex: "half" } as RequestInit),
    });

    await expect(worker.fetch(request, env(assetRouter()))).resolves.toMatchObject({ status: 201 });
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("preserves same-origin auth shell routes and no-cache HTML", async () => {
    const response = await worker.fetch(
      new Request("https://staging.musuw.workers.dev/auth/start"),
      env(assetRouter()),
    );
    expect(await response.text()).toBe("auth shell");
    expect(response.headers.get("cache-control")).toBe("no-cache, must-revalidate");
    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
  });

  it("serves hashed product and auth assets as immutable", async () => {
    const productAsset = await worker.fetch(
      new Request("https://staging.musuw.workers.dev/assets/app-abc.js"),
      env(assetRouter()),
    );
    const authAsset = await worker.fetch(
      new Request("https://staging.musuw.workers.dev/auth/assets/auth-abc.js"),
      env(assetRouter()),
    );
    expect(productAsset.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(authAsset.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  });

  it("keeps embed fallback frameable while product fallback stays protected", async () => {
    const embed = await worker.fetch(
      new Request("https://staging.musuw.workers.dev/embed/some-knowledge-base"),
      env(assetRouter()),
    );
    const product = await worker.fetch(
      new Request("https://staging.musuw.workers.dev/workspace"),
      env(assetRouter()),
    );
    expect(await embed.text()).toBe("embed shell");
    expect(embed.headers.has("x-frame-options")).toBe(false);
    expect(await product.text()).toBe("product shell");
    expect(product.headers.get("x-frame-options")).toBe("SAMEORIGIN");
  });

  it("redirects /auth to /auth/start without involving the origin", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await worker.fetch(
      new Request("https://staging.musuw.workers.dev/auth"),
      env(assetRouter()),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://staging.musuw.workers.dev/auth/start");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fails closed for a malformed origin configuration and origin outages", async () => {
    const malformed = env(assetRouter());
    (malformed as unknown as { ORIGIN_APP_URL: string }).ORIGIN_APP_URL = "javascript:alert(1)";
    await expect(
      worker.fetch(new Request("https://staging.musuw.workers.dev/health"), malformed),
    ).resolves.toMatchObject({ status: 500 });

    const insecure = env(assetRouter());
    (insecure as unknown as { ORIGIN_APP_URL: string }).ORIGIN_APP_URL = "http://origin-app.musuw.com";
    await expect(
      worker.fetch(new Request("https://staging.musuw.workers.dev/health"), insecure),
    ).resolves.toMatchObject({ status: 500 });

    const wrongHost = env(assetRouter());
    (wrongHost as unknown as { ORIGIN_APP_URL: string }).ORIGIN_APP_URL = "https://example.invalid";
    await expect(
      worker.fetch(new Request("https://staging.musuw.workers.dev/health"), wrongHost),
    ).resolves.toMatchObject({ status: 500 });

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    await expect(
      worker.fetch(
        new Request("https://staging.musuw.workers.dev/health"),
        env(assetRouter()),
      ),
    ).resolves.toMatchObject({ status: 502 });
  });

  it("fails closed when only one origin Access credential is present", async () => {
    const partial = env(assetRouter()) as unknown as {
      ORIGIN_ACCESS_CLIENT_ID?: string;
      ORIGIN_ACCESS_CLIENT_SECRET?: string;
    } & WorkerEnv;
    partial.ORIGIN_ACCESS_CLIENT_ID = "client-id";
    await expect(
      worker.fetch(new Request("https://staging.musuw.workers.dev/health"), partial),
    ).resolves.toMatchObject({ status: 500 });
  });

  it("does not trust client-supplied Cloudflare Access headers", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
    const request = new Request("https://staging.musuw.workers.dev/health", {
      headers: {
        "CF-Access-Client-Id": "attacker-id",
        "CF-Access-Client-Secret": "attacker-secret",
        "CF-Access-Jwt-Assertion": "attacker-jwt",
        "CF-Connecting-IP": "198.51.100.20",
        "True-Client-IP": "198.51.100.21",
        "X-Real-IP": "198.51.100.22",
        "X-Forwarded-For": "198.51.100.23",
      },
    });

    await worker.fetch(request, env(assetRouter()));

    const sentRequest = fetchSpy.mock.calls[0]?.[0] as Request;
    expect(sentRequest.headers.has("CF-Access-Client-Id")).toBe(false);
    expect(sentRequest.headers.has("CF-Access-Client-Secret")).toBe(false);
    expect(sentRequest.headers.has("CF-Access-Jwt-Assertion")).toBe(false);
    expect(sentRequest.headers.has("CF-Connecting-IP")).toBe(false);
    expect(sentRequest.headers.has("True-Client-IP")).toBe(false);
    expect(sentRequest.headers.has("X-Real-IP")).toBe(false);
    expect(sentRequest.headers.has("X-Forwarded-For")).toBe(false);
  });

  it("rejects WebSocket upgrades because the edge contract is HTTP streaming only", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await worker.fetch(
      new Request("https://staging.musuw.workers.dev/api/v1/chat", {
        headers: { Upgrade: "websocket" },
      }),
      env(assetRouter()),
    );

    expect(response.status).toBe(426);
    expect(response.headers.get("upgrade")).toBe("websocket");
    expect(await response.json()).toEqual({ error: "websocket_not_supported" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not turn non-GET application requests into static shell responses", async () => {
    const response = await worker.fetch(
      new Request("https://staging.musuw.workers.dev/workspace", { method: "POST", body: "mutate" }),
      env(assetRouter()),
    );
    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ error: "method_not_allowed" });
  });
});
