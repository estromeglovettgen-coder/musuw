import assert from "node:assert/strict";
import test from "node:test";

import {
  localizeDocumentResponse,
  selectLocale,
} from "../worker/localization.js";
import { handleRequest } from "../worker/index.js";

function requestWithCountry(url, country, init) {
  const request = new Request(url, init);
  Object.defineProperty(request, "cf", { value: { country } });
  return request;
}

test("the Worker selects Chinese only for Cloudflare country CN", () => {
  assert.equal(selectLocale("CN"), "zh-CN");
  assert.equal(selectLocale("US"), "en");
  assert.equal(selectLocale(undefined), "en");
});

test("an explicit legal-page locale and saved preference override country fallback", () => {
  assert.equal(selectLocale("US", "", "zh-CN"), "zh-CN");
  assert.equal(selectLocale("CN", "", "en"), "en");
  assert.equal(selectLocale("US", "musuw_locale=zh-CN"), "zh-CN");
  assert.equal(selectLocale("CN", "musuw_locale=en"), "en");
  assert.equal(selectLocale("CN", "musuw_locale=invalid", "invalid"), "zh-CN");
});

test("localized HTML hands the country signal to the product subdomain", async () => {
  const source = new Response(
    '<html lang="en"><head></head><body></body></html>',
    { headers: { "content-type": "text/html" } },
  );
  const response = await localizeDocumentResponse(source, "zh-CN", "/", "musuw.com");

  assert.match(
    response.headers.get("set-cookie") ?? "",
    /musuw_locale=zh-CN/,
  );
  assert.match(
    response.headers.get("set-cookie") ?? "",
    /Domain=\.musuw\.com/,
  );
  assert.match(response.headers.get("set-cookie") ?? "", /SameSite=Lax/);
});

test("localized documents receive bounded metadata and private caching", async () => {
  const source = new Response(
    '<html lang="en"><head><title>musuw</title><meta name="description" content="Home"></head><body></body></html>',
    { headers: { "content-type": "text/html", etag: '"old"' } },
  );
  const response = await localizeDocumentResponse(source, "zh-CN", "/privacy");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-language"), "zh-CN");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("etag"), null);
  assert.match(html, /<title>隐私政策 \| musuw<\/title>/);
  assert.match(html, /href="https:\/\/musuw\.com\/privacy"/);
  assert.match(html, /__MUSUW_LOCALE__="zh-CN"/);
});

test("HTML is localized while hashed assets stay immutable", async () => {
  const env = {
    ASSETS: {
      async fetch(request) {
        return new URL(request.url).pathname.startsWith("/assets/")
          ? new Response("css", { headers: { "content-type": "text/css" } })
          : new Response('<html lang="en"><head></head><body></body></html>', {
              headers: { "content-type": "text/html" },
            });
      },
    },
  };
  const documentResponse = await handleRequest(
    requestWithCountry("https://musuw.com/", "CN"),
    env,
  );
  assert.equal(documentResponse.headers.get("content-language"), "zh-CN");

  const explicitLocaleResponse = await handleRequest(
    requestWithCountry("https://musuw.com/privacy?lang=en", "CN"),
    env,
  );
  assert.equal(explicitLocaleResponse.headers.get("content-language"), "en");

  const assetResponse = await handleRequest(
    requestWithCountry("https://musuw.com/assets/app-123.css", "CN"),
    env,
  );
  assert.equal(assetResponse.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.equal(assetResponse.headers.get("content-language"), null);
});
