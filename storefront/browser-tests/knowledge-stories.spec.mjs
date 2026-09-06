import { test, expect } from "@playwright/test";

async function checkPageWidth(page) {
  const sizes = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
  expect(sizes.content, JSON.stringify(sizes)).toBeLessThanOrEqual(sizes.viewport + 2);
}
async function capture(locator, name, testInfo) {
  const path = testInfo.outputPath(`${name}.png`);
  await locator.screenshot({ path });
  await testInfo.attach(name, { path, contentType: "image/png" });
}
async function assertSource(page, parent, id, testInfo, name) {
  const source = parent.locator(`[data-demo-source="${id}"]`);
  await expect(source).toBeVisible();
  await expect(source.locator("p")).not.toBeEmpty();
  const bounds = await source.boundingBox();
  expect(bounds.width).toBeGreaterThan(100);
  expect(bounds.x).toBeGreaterThanOrEqual(-1);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  await capture(parent, name, testInfo);
  await source.locator("header button").click();
  await expect(source).toHaveCount(0);
}

for (const locale of ["zh-CN", "en"]) {
  for (const reducedMotion of ["no-preference", "reduce"]) {
    test(`${locale} / ${reducedMotion}: four independent stories`, async ({ page }, testInfo) => {
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.emulateMedia({ reducedMotion });
      await page.addInitScript((value) => {
        window.__MUSUW_LOCALE__ = value;
        localStorage.setItem("musuw_locale", value);
      }, locale);
      await page.goto("/", { waitUntil: "networkidle" });
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("h1")).toHaveAttribute("aria-label", locale === "zh-CN" ? "把资料转化为 会思考的知识资产" : "Turn source material into intelligent knowledge assets");
      await expect(page.locator(".feature-story")).toHaveCount(3);
      await checkPageWidth(page);

      const hero = page.locator('[data-story="everyday-law"]');
      await hero.scrollIntoViewIfNeeded();
      await expect(hero).toHaveAttribute("data-demo-phase", "complete", { timeout: 35_000 });
      await expect(hero.locator(".hero-demo-question")).toContainText(locale === "zh-CN" ? "婚礼摄影师" : "wedding photographer");
      await expect(hero.locator(".demo-scope-note")).toBeVisible();
      await expect(hero.locator(".hero-demo-citation")).toHaveCount(3);
      // Reading must not depend on hidden overflow in the fixed hero viewport.
      const heroGeometry = await hero.locator(".hero-demo-thread").evaluate((node) => ({ height: node.clientHeight, scroll: node.scrollHeight, overflow: getComputedStyle(node).overflowY }));
      expect(heroGeometry.overflow !== "hidden" || heroGeometry.scroll <= heroGeometry.height + 2, JSON.stringify(heroGeometry)).toBeTruthy();
      await hero.locator(".hero-demo-citation").nth(1).click();
      await assertSource(page, hero, locale === "zh-CN" ? "cn-portrait" : "uk-private-photos", testInfo, "hero-source");
      await capture(hero, "hero-answer", testInfo);

      const chat = page.locator('[data-capability-demo="reasoning"]');
      await chat.scrollIntoViewIfNeeded();
      await expect(chat).toHaveAttribute("data-chat-phase", "complete", { timeout: 45_000 });
      await expect(chat.locator(".visual-assistant-markdown")).toContainText(locale === "zh-CN" ? "首次练习" : "first completed exercise");
      await expect(chat.locator(".demo-scope-note")).toContainText(locale === "zh-CN" ? "模拟" : "Simulated");
      await chat.locator(".real-chat-citation").nth(1).click();
      await assertSource(page, chat, "support", testInfo, "reasoning-source");
      await capture(chat, "reasoning-answer", testInfo);

      const wiki = page.locator('[data-product-page-shell="wiki"]');
      await wiki.scrollIntoViewIfNeeded();
      await expect(wiki.locator('[data-wiki-reader="true"]')).toBeVisible();
      await expect(wiki.locator(".wiki-reader-title-text")).toHaveText(locale === "zh-CN" ? "长期记忆评估" : "Memory Evaluation");
      const trigger = wiki.locator('[data-wiki-source-trigger="true"]');
      if (reducedMotion === "reduce") {
        await expect(wiki).toHaveAttribute("data-demo-phase", "page");
        await expect(wiki.locator("[data-demo-pointer]")).toHaveCount(0);
        await trigger.click();
        await assertSource(page, wiki, "longmemeval", testInfo, "wiki-source");
      } else {
        await expect(wiki).toHaveAttribute("data-demo-phase", "hovering-source", { timeout: 15_000 });
        await expect(trigger).toBeInViewport();
        await expect(wiki).toHaveAttribute("data-demo-phase", "source-open");
        await expect(wiki.locator('[data-demo-source="longmemeval"]')).toBeVisible();
        const beforeZoom = await wiki.locator(".kb-product-preview").evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).a);
        expect(beforeZoom).toBeCloseTo(1, 2);
        await expect(wiki).toHaveAttribute("data-demo-phase", "focus-source");
        await expect.poll(async () => wiki.locator(".kb-product-preview").evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).a)).toBeGreaterThan(1.06);
        const focusedScale = await wiki.locator(".kb-product-preview").evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).a);
        expect(focusedScale).toBeLessThanOrEqual(1.08);
        await capture(wiki, "wiki-focused-source", testInfo);
        await expect(wiki).toHaveAttribute("data-demo-phase", "restore");
        await expect(wiki).toHaveAttribute("data-demo-phase", "page");
        await expect(wiki.locator("[data-demo-source]")).toHaveCount(0);
        await trigger.click();
        await assertSource(page, wiki, "longmemeval", testInfo, "wiki-manual-source");
      }
      await capture(wiki, "wiki-page", testInfo);

      const graph = page.locator('[data-product-page-shell="graph"]');
      await graph.scrollIntoViewIfNeeded();
      await expect(graph).toContainText(locale === "zh-CN" ? "《小王子》阅读笔记" : "The Little Prince");
      await expect(graph.locator("canvas")).toBeVisible();
      await expect(graph.locator("[data-playback-total]")).toHaveAttribute("data-playback-total", "14");
      await expect(graph.locator('[data-graph-action], [data-graph-settings="true"]')).toHaveCount(0);
      const graphPointerEvents = await graph.locator(".kb-preview-graph-canvas").evaluate((node) => getComputedStyle(node).pointerEvents);
      expect(graphPointerEvents).toBe("none");
      await capture(graph, "graph", testInfo);
      await checkPageWidth(page);
      expect(errors).toEqual([]);
    });
  }
}
