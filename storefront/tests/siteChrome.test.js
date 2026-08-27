import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { getStorefrontCopy } from "../src/i18n.js";
import { APP_LOGIN_URL, APP_URL } from "../src/productHandoff.js";

const root = new URL("../", import.meta.url).pathname;

test("product entry links expose the same guest and authenticated actions on desktop and mobile", async (t) => {
  const server = await createServer({
    root,
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  t.after(() => server.close());

  const { ButtonLink, ProductEntryLinks } = await server.ssrLoadModule(
    "/src/components/SiteChrome.jsx",
  );
  assert.equal(typeof ProductEntryLinks, "function");

  for (const surface of ["desktop", "mobile"]) {
    const guestActions = renderToStaticMarkup(
      React.createElement(
        "div",
        { "data-surface": surface },
        React.createElement(ProductEntryLinks, { copy: getStorefrontCopy("en") }),
      ),
    );
    assert.equal(
      (guestActions.match(/href="https:\/\/app\.musuw\.com\/auth\/start"/g) ?? []).length,
      2,
    );
    assert.match(guestActions, />Log in<\/span>/);
    assert.match(guestActions, />Start free<\/span>/);
    assert.doesNotMatch(guestActions, /Open musuw|target="_blank"|rel="noreferrer"/);

    const authenticatedActions = renderToStaticMarkup(
      React.createElement(
        "div",
        { "data-surface": surface },
        React.createElement(ProductEntryLinks, {
          authenticated: true,
          copy: getStorefrontCopy("en"),
        }),
      ),
    );
    assert.equal((authenticatedActions.match(/<a /g) ?? []).length, 1);
    assert.match(authenticatedActions, new RegExp(`href="${APP_URL}"`));
    assert.match(authenticatedActions, />Open musuw<\/span>/);
    assert.doesNotMatch(authenticatedActions, /Log in|Start free|\/auth\/start/);
  }

  const explicitNewTab = renderToStaticMarkup(
    React.createElement(ButtonLink, { href: APP_LOGIN_URL, newTab: true }, "Open separately"),
  );
  assert.match(explicitNewTab, /target="_blank"/);
  assert.match(explicitNewTab, /rel="noreferrer"/);
});

test("language selection is one compact ZH and EN dropdown", async (t) => {
  const server = await createServer({
    root,
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  t.after(() => server.close());

  const { LanguageSwitcher } = await server.ssrLoadModule(
    "/src/components/SiteChrome.jsx",
  );
  const english = renderToStaticMarkup(
    React.createElement(LanguageSwitcher, { locale: "en" }),
  );
  const chinese = renderToStaticMarkup(
    React.createElement(LanguageSwitcher, { locale: "zh-CN" }),
  );

  for (const markup of [english, chinese]) {
    assert.equal((markup.match(/<select\b/g) ?? []).length, 1);
    assert.equal((markup.match(/<option\b/g) ?? []).length, 2);
    assert.match(markup, /<option value="zh-CN"(?: selected="")?>ZH<\/option>/);
    assert.match(markup, /<option value="en"(?: selected="")?>EN<\/option>/);
    assert.doesNotMatch(markup, /lang-btn|lang-globe-icon|<button/);
  }
  assert.match(english, /<option value="en" selected="">EN<\/option>/);
  assert.match(chinese, /<option value="zh-CN" selected="">ZH<\/option>/);
});
