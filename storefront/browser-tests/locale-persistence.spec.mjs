import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { handleRequest } from "../worker/index.js";

// Keep the actual Worker and built React app. Only Cloudflare's country and
// static asset bindings are local, so Chromium owns real cookies and history.
async function serveStorefront(context, country) {
  await context.route("**/*", async (route) => {
    const incoming = route.request();
    const url = new URL(incoming.url());
    if (!["musuw.com", "www.musuw.com"].includes(url.hostname)) {
      return route.abort();
    }
    const request = new Request(url, { headers: await incoming.allHeaders() });
    Object.defineProperty(request, "cf", { value: { country } });
    const response = await handleRequest(request, {
      ASSETS: {
        async fetch(assetRequest) {
          const pathname = new URL(assetRequest.url).pathname;
          const asset = pathname.startsWith("/assets/");
          const body = await readFile(new URL(asset ? `../dist${pathname}` : "../dist/index.html", import.meta.url));
          const type = !asset ? "text/html" : pathname.endsWith(".css") ? "text/css" : "text/javascript";
          return new Response(body, { headers: { "content-type": type } });
        },
      },
    });
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
  });
}

test.use({ reducedMotion: "reduce" });

for (const hostname of ["musuw.com", "www.musuw.com"]) {
  for (const [initial, selected] of [["zh-CN", "en"], ["en", "zh-CN"]]) {
    test(`${hostname}: selecting ${selected} survives refreshing an explicit ${initial} link`, async ({ page, context }) => {
      await serveStorefront(context, "CN");
      await page.goto(`https://${hostname}/?lang=${initial}&source=footer#pricing`, { waitUntil: "domcontentloaded" });
      await expect(page.locator(".lang-select")).toHaveValue(initial);
      await page.locator(".lang-select").selectOption(selected);
      await expect(page.locator("html")).toHaveAttribute("lang", selected);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator(".lang-select")).toHaveValue(selected);
      await expect(page.locator("html")).toHaveAttribute("lang", selected);
      const url = new URL(page.url());
      expect(url.searchParams.get("source")).toBe("footer");
      expect(url.hash).toBe("#pricing");
      await expect(page.locator("#pricing")).toContainText("¥29");
    });
  }
}

test("a manual choice replaces conflicting legacy www cookies and follows navigation to the apex", async ({ page, context }) => {
  await serveStorefront(context, "CN");
  await context.addCookies([
    { name: "musuw_locale", value: "zh-CN", domain: ".musuw.com", path: "/", secure: true },
    { name: "musuw_locale", value: "zh-CN", url: "https://www.musuw.com/" },
  ]);
  await page.goto("https://www.musuw.com/", { waitUntil: "domcontentloaded" });
  await page.locator(".lang-select").selectOption("en");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".lang-select")).toHaveValue("en");
  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("https://musuw.com/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".lang-select")).toHaveValue("en");
  expect((await context.cookies()).filter(({ name }) => name === "musuw_locale").map(({ domain, value }) => ({ domain, value })))
    .toEqual([{ domain: ".musuw.com", value: "en" }]);
});

test("Japanese prices visibly identify yen in both interface languages", async ({ page, context }) => {
  await serveStorefront(context, "JP");
  await page.goto("https://musuw.com/?lang=zh-CN#pricing", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#pricing")).toContainText("JP¥798");
  await page.locator(".lang-select").selectOption("en");
  await expect(page.locator("#pricing")).toContainText("JP¥798");
});
