import assert from "node:assert/strict";
import test from "node:test";
import { getInitialLocale, persistLocalePreference } from "../src/i18n.js";
import { handleRequest } from "../worker/index.js";

const assets = {
  ASSETS: {
    async fetch() {
      return new Response('<html lang="en"><head></head><body></body></html>', {
        headers: { "content-type": "text/html" },
      });
    },
  },
};

// Only browser platform storage/history are represented here. Both the client
// preference writer and the Worker handling the next document request are real.
function browserAt(url, initialCookie = "") {
  let cookie = initialCookie;
  const values = new Map();
  const window = {
    location: new URL(url),
    history: {
      state: null,
      replaceState(state, _title, nextUrl) {
        this.state = state;
        window.location = new URL(nextUrl, window.location);
      },
    },
  };
  const document = {
    cookieWrites: [],
    get cookie() { return cookie; },
    set cookie(value) {
      this.cookieWrites.push(value);
      cookie = value.split(";")[0];
    },
  };
  const localStorage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
  return { window, document, localStorage };
}

function installBrowser(t, browser) {
  for (const [name, value] of Object.entries(browser)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value, configurable: true });
    t.after(() => descriptor ? Object.defineProperty(globalThis, name, descriptor) : delete globalThis[name]);
  }
}

async function reload(browser, country) {
  const request = new Request(browser.window.location, {
    headers: { cookie: browser.document.cookie },
  });
  Object.defineProperty(request, "cf", { value: { country } });
  const response = await handleRequest(request, assets);
  const html = await response.text();
  browser.window.__MUSUW_LOCALE__ = JSON.parse(html.match(/window\.__MUSUW_LOCALE__=([^;]+)/)[1]);
  return { response, locale: getInitialLocale() };
}

for (const [initialLocale, selectedLocale, country] of [
  ["zh-CN", "en", "CN"],
  ["en", "zh-CN", "US"],
]) {
  test(`manual ${selectedLocale} survives refresh of a URL explicitly opened in ${initialLocale}`, async (t) => {
    const browser = browserAt(`https://musuw.com/privacy?lang=${initialLocale}&source=footer#cookies`);
    installBrowser(t, browser);
    browser.window.history.state = { retained: "navigation" };
    assert.equal((await reload(browser, country)).locale, initialLocale);

    persistLocalePreference(selectedLocale);
    assert.equal(getInitialLocale(), selectedLocale);

    const refreshed = await reload(browser, country);
    assert.equal(refreshed.response.headers.get("content-language"), selectedLocale);
    assert.equal(refreshed.locale, selectedLocale);
    assert.equal(browser.window.location.pathname, "/privacy");
    assert.equal(browser.window.location.searchParams.get("source"), "footer");
    assert.equal(browser.window.location.hash, "#cookies");
    assert.deepEqual(browser.window.history.state, { retained: "navigation" });
  });
}


test("a fresh explicit link still overrides a different saved preference", async (t) => {
  const browser = browserAt("https://musuw.com/privacy?lang=en", "musuw_locale=zh-CN");
  browser.localStorage.setItem("musuw_locale", "zh-CN");
  installBrowser(t, browser);

  assert.equal((await reload(browser, "CN")).locale, "en");
});

test("manual choice without a locale query survives navigation and blocked local storage", async (t) => {
  const browser = browserAt("https://www.musuw.com/?source=footer#pricing");
  browser.localStorage.setItem = () => { throw new Error("Storage disabled"); };
  installBrowser(t, browser);
  await reload(browser, "CN");

  persistLocalePreference("en");
  assert.equal(browser.window.location.href, "https://www.musuw.com/?source=footer#pricing");
  const writes = browser.document.cookieWrites;
  assert.match(writes[0], /Max-Age=0/);
  assert.doesNotMatch(writes[0], /Domain=/);
  const response = (await reload(browser, "CN")).response;
  assert.equal(response.headers.get("content-language"), "en");
  assert.equal(writes.at(-1), response.headers.get("set-cookie"));

  browser.window.location = new URL("https://www.musuw.com/privacy");
  assert.equal((await reload(browser, "CN")).locale, "en");
});

test("localhost retains manual locale with a local cookie and no production domain", async (t) => {
  const browser = browserAt("http://127.0.0.1:4190/");
  installBrowser(t, browser);
  await reload(browser, "US");

  persistLocalePreference("zh-CN");
  assert.doesNotMatch(browser.document.cookieWrites.at(-1), /Domain=|Secure/);
  assert.equal((await reload(browser, "US")).locale, "zh-CN");
});
