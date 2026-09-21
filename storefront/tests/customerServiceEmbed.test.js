import assert from "node:assert/strict";
import test from "node:test";

import {
  CUSTOMER_SERVICE_CONFIG_PATH,
  normalizeCustomerServiceConfig,
  widgetLocale,
} from "../src/customerServiceEmbed.js";
import { handleRequest } from "../worker/index.js";
import {
  CUSTOMER_SERVICE_TOKEN_PATH,
  customerServiceResponse,
} from "../worker/customerService.js";

const configuredEnvironment = {
  MUSUW_CUSTOMER_SERVICE_APP_ORIGIN: "https://app.musuw.com",
  MUSUW_CUSTOMER_SERVICE_CHANNEL_ID: "channel-homepage",
  MUSUW_CUSTOMER_SERVICE_PUBLISH_TOKEN: "publish-token-placeholder",
};

test("the public config enables the existing widget without exposing its publish token", async () => {
  const response = await handleRequest(
    new Request(`https://musuw.com${CUSTOMER_SERVICE_CONFIG_PATH}`),
    configuredEnvironment,
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(body, {
    enabled: true,
    baseUrl: "https://app.musuw.com",
    channelId: "channel-homepage",
    scriptUrl: "https://app.musuw.com/musuw-widget.js",
    tokenEndpoint: "https://musuw.com/_musuw/customer-service/token",
  });
  assert.doesNotMatch(JSON.stringify(body), /publish-token-placeholder/);
});

test("the public config disables the widget when either runtime binding is absent", async () => {
  const response = await handleRequest(
    new Request(`https://musuw.com${CUSTOMER_SERVICE_CONFIG_PATH}`),
    { MUSUW_CUSTOMER_SERVICE_CHANNEL_ID: "channel-homepage" },
  );

  assert.deepEqual(await response.json(), { enabled: false });
});

test("the token endpoint exchanges the server-held publish token for a short session token", async () => {
  let upstreamRequest;
  const response = await customerServiceResponse(
    new Request(`https://musuw.com${CUSTOMER_SERVICE_TOKEN_PATH}`, {
      headers: { origin: "https://musuw.com" },
    }),
    configuredEnvironment,
    undefined,
    async (url, init) => {
      upstreamRequest = { init, url };
      return Response.json({
        success: true,
        data: { expires_in: 1800, session_token: "short-session-token" },
      });
    },
  );

  assert.deepEqual(upstreamRequest, {
    url: "https://app.musuw.com/api/v1/embed/channel-homepage/exchange",
    init: {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: "Embed publish-token-placeholder",
        origin: "https://musuw.com",
      },
    },
  });
  assert.deepEqual(await response.json(), { token: "short-session-token", expiresIn: 1800 });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("the token endpoint rejects cross-origin callers and hides upstream failures", async () => {
  const blocked = await customerServiceResponse(
    new Request(`https://musuw.com${CUSTOMER_SERVICE_TOKEN_PATH}`, {
      headers: { origin: "https://untrusted.example" },
    }),
    configuredEnvironment,
    undefined,
    async () => assert.fail("cross-origin request must not reach the application"),
  );
  assert.equal(blocked.status, 403);

  const failed = await customerServiceResponse(
    new Request(`https://musuw.com${CUSTOMER_SERVICE_TOKEN_PATH}`),
    configuredEnvironment,
    undefined,
    async () => Response.json({ error: "private upstream detail" }, { status: 401 }),
  );
  assert.equal(failed.status, 502);
  assert.deepEqual(await failed.json(), { error: "TOKEN_EXCHANGE_FAILED" });
});

test("browser config accepts only the app SDK and a same-origin token endpoint", () => {
  assert.deepEqual(
    normalizeCustomerServiceConfig(
      {
        enabled: true,
        baseUrl: "https://app.musuw.com",
        channelId: " channel-homepage ",
        scriptUrl: "https://app.musuw.com/musuw-widget.js",
        tokenEndpoint: CUSTOMER_SERVICE_TOKEN_PATH,
      },
      "https://musuw.com",
    ),
    {
      baseUrl: "https://app.musuw.com",
      channelId: "channel-homepage",
      scriptUrl: "https://app.musuw.com/musuw-widget.js",
      tokenEndpoint: "https://musuw.com/_musuw/customer-service/token",
    },
  );

  assert.equal(
    normalizeCustomerServiceConfig(
      {
        enabled: true,
        baseUrl: "https://app.musuw.com",
        channelId: "channel-homepage",
        scriptUrl: "https://evil.example/widget.js",
        tokenEndpoint: CUSTOMER_SERVICE_TOKEN_PATH,
      },
      "https://musuw.com",
    ),
    null,
  );
  assert.equal(
    normalizeCustomerServiceConfig(
      {
        enabled: true,
        baseUrl: "https://app.musuw.com",
        channelId: "channel-homepage",
        scriptUrl: "https://app.musuw.com/musuw-widget.js",
        tokenEndpoint: "https://evil.example/token",
      },
      "https://musuw.com",
    ),
    null,
  );
  assert.equal(widgetLocale("zh-CN"), "zh-CN");
  assert.equal(widgetLocale("en"), "en-US");
});
