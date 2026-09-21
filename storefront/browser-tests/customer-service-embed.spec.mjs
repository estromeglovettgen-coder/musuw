import { expect, test } from "@playwright/test";

test("configured homepage mounts the existing Musuw widget at bottom-right", async ({ page }, testInfo) => {
  const storefrontOrigin = new URL(testInfo.project.use.baseURL).origin;
  await page.addInitScript(() => localStorage.setItem("musuw_locale", "zh-CN"));
  await page.route("**/_musuw/customer-service/config", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      enabled: true,
      baseUrl: "https://app.musuw.com",
      channelId: "channel-homepage",
      scriptUrl: "https://app.musuw.com/musuw-widget.js",
      tokenEndpoint: `${storefrontOrigin}/_musuw/customer-service/token`,
    }),
  }));
  await page.route("https://app.musuw.com/musuw-widget.js", (route) => route.fulfill({
    contentType: "text/javascript",
    body: `
      window.__customerServiceCalls = [];
      window.Musuw = {
        init(options) {
          window.__customerServiceCalls.push({ type: 'init', options });
          const button = document.createElement('button');
          button.dataset.customerServiceLauncher = 'true';
          button.style.position = 'fixed';
          button.style.right = '24px';
          button.style.bottom = '24px';
          button.textContent = 'chat';
          document.body.appendChild(button);
          return {
            setContext(context) { window.__customerServiceCalls.push({ type: 'context', context }); },
            setLocale(locale) { window.__customerServiceCalls.push({ type: 'locale', locale }); },
            destroy() { button.remove(); },
          };
        },
      };
    `,
  }));

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const launcher = page.locator('[data-customer-service-launcher="true"]');
  await expect(launcher).toBeVisible();
  const calls = await page.evaluate(() => window.__customerServiceCalls);
  expect(calls).toContainEqual({
    type: "locale",
    locale: "zh-CN",
  });
  expect(calls.find(({ type }) => type === "init")?.options).toMatchObject({
    baseUrl: "https://app.musuw.com",
    channel: "channel-homepage",
    position: "bottom-right",
    title: "Musuw 智能客服",
  });
  const position = await launcher.evaluate((element) => {
    const style = getComputedStyle(element);
    return { bottom: style.bottom, position: style.position, right: style.right };
  });
  expect(position).toEqual({ bottom: "24px", position: "fixed", right: "24px" });
});
