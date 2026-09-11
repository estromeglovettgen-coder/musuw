import { expect, test } from '@playwright/test';

test('typing in the login form keeps the existing liquid background and WebGL context', async ({ page }, info) => {
  await page.route('**/config.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: `window.__RUNTIME_CONFIG__ = ${JSON.stringify({ auth: {
      publicOrigin: 'http://127.0.0.1:4190',
      supabaseUrl: 'https://auth-fixture.invalid',
      publishableKey: 'sb_publishable_auth_fixture',
      weknoraOAuthClientId: 'auth-fixture-client',
    } })};`,
  }));
  await page.route('https://auth-fixture.invalid/**', route => route.fulfill({ status: 401, json: {} }));
  await page.goto('/auth/start');
  await expect(page.locator('#email')).toBeVisible();
  const canvas = page.locator('.auth-liquid-ether canvas');
  await expect(canvas).toHaveCount(1);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const originalCanvas = await canvas.elementHandle();
  const before = await page.locator('.auth-showcase').boundingBox();
  const mutations = await page.locator('.auth-showcase-backdrop').evaluateHandle(backdrop => {
    const state = { canvasesAdded: 0, canvasesRemoved: 0, contextsLost: 0 };
    const observeContext = (canvas: HTMLCanvasElement) => {
      canvas.addEventListener('webglcontextlost', () => { state.contextsLost++; });
    };
    backdrop.querySelectorAll('canvas').forEach(observeContext);
    new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof HTMLCanvasElement) { state.canvasesAdded++; observeContext(node); }
        }
        for (const node of record.removedNodes) {
          if (node instanceof HTMLCanvasElement) state.canvasesRemoved++;
        }
      }
    }).observe(backdrop, { childList: true, subtree: true });
    return state;
  });

  await page.locator('#email').click();
  await page.locator('#email').pressSequentially('test@example.invalid', { delay: 40 });
  await page.locator('#password').click();
  await page.locator('#password').pressSequentially('fixture-password', { delay: 40 });
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const observed = await mutations.jsonValue();
  await info.attach('background-lifecycle.json', { body: JSON.stringify(observed), contentType: 'application/json' });
  expect(observed).toEqual({ canvasesAdded: 0, canvasesRemoved: 0, contextsLost: 0 });
  expect(await originalCanvas!.evaluate(node => node.isConnected)).toBe(true);
  expect(await page.locator('.auth-showcase').boundingBox()).toEqual(before);
  await expect(page.locator('.auth-showcase')).toHaveCSS('background-color', 'rgb(8, 8, 8)');
  await expect(page.locator('#email')).toHaveValue('test@example.invalid');
  await expect(page.locator('#password')).toHaveValue('fixture-password');
});
