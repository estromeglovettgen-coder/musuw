export const CUSTOMER_SERVICE_CONFIG_PATH = "/_musuw/customer-service/config";
export const CUSTOMER_SERVICE_TOKEN_PATH = "/_musuw/customer-service/token";

const NO_STORE_HEADERS = {
  "cache-control": "private, no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
};

function json(body, init = {}) {
  return Response.json(body, {
    ...init,
    headers: { ...NO_STORE_HEADERS, ...(init.headers ?? {}) },
  });
}

function runtimeConfig(env) {
  const channelId = String(env.MUSUW_CUSTOMER_SERVICE_CHANNEL_ID ?? "").trim();
  const publishToken = String(env.MUSUW_CUSTOMER_SERVICE_PUBLISH_TOKEN ?? "").trim();
  const rawAppOrigin = String(
    env.MUSUW_CUSTOMER_SERVICE_APP_ORIGIN ?? "https://app.musuw.com",
  ).trim();

  if (!channelId || !publishToken) return null;

  try {
    const appOrigin = new URL(rawAppOrigin);
    if (appOrigin.protocol !== "https:") return null;
    return { appOrigin: appOrigin.origin, channelId, publishToken };
  } catch {
    return null;
  }
}

function sameOriginRequest(request, url) {
  const origin = request.headers.get("origin");
  return !origin || origin === url.origin;
}

async function exchangeSessionToken(request, env, url, fetchImpl) {
  const config = runtimeConfig(env);
  if (!config) return json({ error: "NOT_CONFIGURED" }, { status: 404 });
  if (!sameOriginRequest(request, url)) {
    return json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let upstream;
  try {
    upstream = await fetchImpl(
      `${config.appOrigin}/api/v1/embed/${encodeURIComponent(config.channelId)}/exchange`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Embed ${config.publishToken}`,
          origin: url.origin,
        },
      },
    );
  } catch {
    return json({ error: "TOKEN_EXCHANGE_FAILED" }, { status: 502 });
  }

  if (!upstream.ok) {
    return json({ error: "TOKEN_EXCHANGE_FAILED" }, { status: 502 });
  }

  let payload;
  try {
    payload = await upstream.json();
  } catch {
    return json({ error: "TOKEN_EXCHANGE_FAILED" }, { status: 502 });
  }
  const sessionToken = payload?.data?.session_token;
  const expiresIn = Number(payload?.data?.expires_in);
  if (typeof sessionToken !== "string" || !sessionToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    return json({ error: "TOKEN_EXCHANGE_FAILED" }, { status: 502 });
  }

  return json({ token: sessionToken, expiresIn });
}

export async function customerServiceResponse(request, env, url = new URL(request.url), fetchImpl = fetch) {
  if (url.pathname === CUSTOMER_SERVICE_CONFIG_PATH) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
    }
    const config = runtimeConfig(env);
    const body = config
      ? {
          enabled: true,
          baseUrl: config.appOrigin,
          channelId: config.channelId,
          scriptUrl: `${config.appOrigin}/musuw-widget.js`,
          tokenEndpoint: `${url.origin}${CUSTOMER_SERVICE_TOKEN_PATH}`,
        }
      : { enabled: false };
    const response = json(body);
    return request.method === "HEAD" ? new Response(null, response) : response;
  }

  if (url.pathname === CUSTOMER_SERVICE_TOKEN_PATH) {
    if (request.method !== "GET") {
      return new Response(null, { status: 405, headers: { allow: "GET" } });
    }
    return exchangeSessionToken(request, env, url, fetchImpl);
  }

  return null;
}
