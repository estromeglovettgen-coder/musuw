/// <reference path="../worker-configuration.d.ts" />

const PRODUCT_SHELL = "/index.html";
const AUTH_SHELL = "/auth/index.html";
const EMBED_SHELL = "/embed.html";

const PROXY_PREFIXES = ["/api/", "/r/"] as const;
const PROXY_EXACT_PATHS = ["/files", "/health"] as const;

type OriginAccessSecrets = {
  ORIGIN_ACCESS_CLIENT_ID?: string;
  ORIGIN_ACCESS_CLIENT_SECRET?: string;
};

function isProxyPath(pathname: string): boolean {
  return (
    PROXY_EXACT_PATHS.includes(pathname as (typeof PROXY_EXACT_PATHS)[number]) ||
    PROXY_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function isGetOrHead(request: Request): boolean {
  return request.method === "GET" || request.method === "HEAD";
}

function staticHeaders(response: Response, pathname: string): Headers {
  const headers = new Headers(response.headers);
  const isEmbed = pathname === EMBED_SHELL || pathname.startsWith("/embed/");
  const isHashedAsset = pathname.startsWith("/assets/") || pathname.startsWith("/auth/assets/");

  if (pathname === "/weknora-widget.js") {
    headers.set("Cache-Control", "public, max-age=3600");
  } else if (isHashedAsset) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  } else {
    headers.set("Cache-Control", "no-cache, must-revalidate");
  }

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-XSS-Protection", "1; mode=block");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  if (isEmbed) {
    headers.delete("X-Frame-Options");
  } else {
    headers.set("X-Frame-Options", "SAMEORIGIN");
  }
  return headers;
}

function withStaticHeaders(response: Response, pathname: string): Response {
  const headers = staticHeaders(response, pathname);
  const init: ResponseInit = {
    status: response.status,
    statusText: response.statusText,
    headers,
  };

  // Keep an already encoded asset encoded when replacing its headers. This is
  // the Workers equivalent of nginx's pass-through handling for compressed
  // static responses.
  if (headers.has("Content-Encoding")) {
    (init as ResponseInit & { encodeBody?: "automatic" | "manual" }).encodeBody = "manual";
  }

  return new Response(response.body, init);
}

function jsonError(status: number, code: string): Response {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function websocketUnsupported(): Response {
  return new Response(JSON.stringify({ error: "websocket_not_supported" }), {
    status: 426,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Upgrade": "websocket",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function originURL(env: Env): URL {
  const value = env.ORIGIN_APP_URL.trim();
  const origin = new URL(value);
  if (
    origin.protocol !== "https:" ||
    origin.hostname !== "origin-app.musuw.com" ||
    origin.port ||
    origin.username ||
    origin.password
  ) {
    throw new Error("origin app URL must be https://origin-app.musuw.com without credentials");
  }
  if (origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("origin app URL must not include a path, query, or fragment");
  }
  return origin;
}

function originRequest(request: Request, env: Env, origin: URL): Request {
  const incomingURL = new URL(request.url);
  const upstreamURL = new URL(incomingURL.pathname + incomingURL.search, origin);
  const headers = new Headers(request.headers);
  const platformClientIP = request.headers.get("CF-Connecting-IP")?.trim();
  const requestHasCloudflareRuntime = Boolean((request as Request & { cf?: unknown }).cf);

  // The URL controls the upstream Host. These forwarding headers retain the
  // public same-origin contract while preventing a client from spoofing it.
  headers.delete("Host");
  // Access identity headers are Worker-only trust signals. Never relay any
  // client-supplied `CF-Access-*` value to the protected origin.
  for (const name of [...headers.keys()]) {
    if (name.toLowerCase().startsWith("cf-access-")) headers.delete(name);
  }
  headers.set("X-Forwarded-Host", incomingURL.host);
  headers.set("X-Forwarded-Proto", incomingURL.protocol.slice(0, -1));
  // These identity headers are untrusted when the Worker is invoked directly
  // (for example in local tests). Cloudflare supplies `request.cf` and the
  // platform CF-Connecting-IP header together; only that pair may rebuild the
  // origin forwarding identity. The CF header itself is never sent upstream.
  for (const name of ["cf-connecting-ip", "true-client-ip", "x-real-ip", "x-forwarded-for"]) {
    headers.delete(name);
  }
  if (requestHasCloudflareRuntime && platformClientIP) {
    headers.set("X-Real-IP", platformClientIP);
    headers.set("X-Forwarded-For", platformClientIP);
  }

  const access = env as Env & OriginAccessSecrets;
  const clientID = access.ORIGIN_ACCESS_CLIENT_ID?.trim();
  const clientSecret = access.ORIGIN_ACCESS_CLIENT_SECRET?.trim();
  if (Boolean(clientID) !== Boolean(clientSecret)) {
    throw new Error("origin access credentials must be configured together");
  }
  if (clientID && clientSecret) {
    headers.set("CF-Access-Client-Id", clientID);
    headers.set("CF-Access-Client-Secret", clientSecret);
  }

  // Constructing from the incoming Request preserves the request body stream
  // (including multipart uploads and SSE POST bodies); it is never read here.
  return new Request(upstreamURL.toString(), new Request(request, { headers }));
}

async function proxy(request: Request, env: Env): Promise<Response> {
  let origin: URL;
  try {
    origin = originURL(env);
  } catch {
    return jsonError(500, "origin_misconfigured");
  }

  let upstream: Request;
  try {
    upstream = originRequest(request, env, origin);
  } catch {
    return jsonError(500, "origin_misconfigured");
  }

  try {
    // Do not let the platform follow an origin redirect. The browser must see
    // the origin's Location and follow it on the public same-origin host.
    return await fetch(upstream, { redirect: "manual" });
  } catch {
    return jsonError(502, "origin_unavailable");
  }
}

async function fetchAsset(request: Request, env: Env, pathname: string): Promise<Response> {
  const direct = await env.ASSETS.fetch(request);
  if (direct.status !== 404 || !isGetOrHead(request)) {
    return withStaticHeaders(direct, pathname);
  }

  let fallbackPath: string | null = null;
  if (pathname === "/auth" || pathname === "/auth/" || pathname === "/auth/start" ||
      pathname === "/auth/callback" || pathname === "/auth/logout" ||
      pathname === "/oauth/consent" || (pathname.startsWith("/auth/") && !pathname.startsWith("/auth/assets/"))) {
    fallbackPath = AUTH_SHELL;
  } else if (pathname.startsWith("/embed/") || pathname === EMBED_SHELL) {
    fallbackPath = EMBED_SHELL;
  } else if (!pathname.includes(".")) {
    fallbackPath = PRODUCT_SHELL;
  }

  if (!fallbackPath) return withStaticHeaders(direct, pathname);

  const fallbackURL = new URL(request.url);
  fallbackURL.pathname = fallbackPath;
  fallbackURL.search = "";
  const fallbackRequest = new Request(fallbackURL, request);
  const fallback = await env.ASSETS.fetch(fallbackRequest);
  return withStaticHeaders(fallback, fallbackPath);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      return websocketUnsupported();
    }

    if (url.pathname === "/auth") {
      return Response.redirect(new URL("/auth/start", request.url).toString(), 302);
    }

    if (isProxyPath(url.pathname)) {
      return proxy(request, env);
    }

    if (!isGetOrHead(request)) {
      return jsonError(405, "method_not_allowed");
    }

    return fetchAsset(request, env, url.pathname);
  },
};
