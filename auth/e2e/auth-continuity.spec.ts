import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// CI installs root + auth only; tsx owns the existing root esbuild dependency.
const requireRoot = createRequire(new URL('../../package.json', import.meta.url));
const { buildSync } = createRequire(requireRoot.resolve('tsx/package.json'))('esbuild');
const bundle = buildSync({
  stdin: { resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'tsx', contents: `
    import {createElement} from 'react';
    import {createRoot} from 'react-dom/client';
    import {AuthApp} from './src/AuthApp';
    import {createAuthRuntime} from './src/runtime';
    import {createSupabaseIdentityClient} from './src/supabase';
    const config = {publicOrigin:'https://app.musuw.com', publishableKey:'fixture-public-key', supabaseUrl:'https://identity.example', weknoraOAuthClientId:'weknora-client'};
    let client;
    let sessionChecks = 0;
    const runtime = createAuthRuntime({config, nativeStorage:localStorage, storage:sessionStorage,
      sharedStorage:localStorage,
      createIdentityClient:()=>{
        client ??= createSupabaseIdentityClient(config, localStorage, sessionStorage);
        return {...client, getSession: async()=>{
          const failure = new URLSearchParams(location.search).get('fail_session');
          if(failure && sessionChecks++ === 0) {
            if(failure === 'timeout') {
              window.__sessionCheckStarted = true;
              await new Promise(() => {});
            }
            else throw Error('synthetic offline');
          }
          return client.getSession();
        }};
      },
      onDiagnostic: event => {window.__diagnostics ??= []; window.__diagnostics.push(event)}
    });
    createRoot(document.getElementById('root')).render(createElement(AuthApp,{runtime}));
  ` }, bundle: true, write: false, format: 'esm', platform: 'browser',
  define: { 'process.env.NODE_ENV': '"production"' },
}).outputFiles[0].text;
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const html = `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>`;
const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'test-user', exp: 4102444800, role: 'authenticated' })).toString('base64url')}.fixture`;
const session = { access_token: token, refresh_token: 'fixture-refresh', expires_in: 3600, expires_at: 4102444800, token_type: 'bearer', user: { id: 'test-user', aud: 'authenticated', role: 'authenticated', email: 'fixture@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } };

async function fixture(page: Page, seedSession = true, rateLimited = false, authorizationDelayMs = 0, blockStorage = false) {
  let authorizationCalls = 0;
  let otpCalls = 0;
  await page.addInitScript(({ session, seedSession, blockStorage }) => {
    localStorage.setItem('locale', 'zh-CN');
    if (seedSession && !localStorage.getItem('fixture-seeded')) {
      localStorage.setItem('musnow.supabase.pkce', JSON.stringify(session));
      localStorage.setItem('fixture-seeded', '1');
    }
    if (blockStorage) {
      const blocked = () => { throw new DOMException('Fixture storage blocked', 'SecurityError'); };
      Storage.prototype.getItem = blocked;
      Storage.prototype.setItem = blocked;
      Storage.prototype.removeItem = blocked;
    }
  }, { session, seedSession, blockStorage });
  await page.route('**/*', async route => {
    const path = new URL(route.request().url()).pathname;
    const json = (value: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    if (path === '/fixture.js') return route.fulfill({ contentType: 'text/javascript', body: bundle });
    if (path === '/auth/v1/otp') { otpCalls++; return json(rateLimited ? { code: 'over_email_send_rate_limit', msg: 'rate limit' } : {}, rateLimited ? 429 : 200); }
    if (path === '/auth/v1/verify') return json(session);
    if (path === '/api/v1/auth/oidc/url') return json({ success: true, authorization_url: 'https://identity.example/next?state=fixture-state' });
    if (path === '/auth/v1/oauth/authorizations/authorization_1') {
      authorizationCalls++;
      if (authorizationDelayMs) await new Promise(resolve => setTimeout(resolve, authorizationDelayMs));
      return json({ authorization_id: 'authorization_1', client: { id: 'weknora-client', name: 'Musuw', uri: '', logo_uri: '' }, redirect_uri: 'https://app.musuw.com/api/v1/auth/oidc/callback', scope: 'openid email profile' });
    }
    if (path === '/auth/v1/oauth/authorizations/authorization_1/consent') return json({ redirect_url: 'https://app.musuw.com/api/v1/auth/oidc/callback?code=fixture-code&state=fixture-state' });
    if (path === '/api/v1/auth/oidc/callback') return route.fulfill({ contentType: 'text/html', body: '<main>Callback reached</main>' });
    if (path === '/fixture-transition') return route.fulfill({ contentType: 'text/html', body: '<main>Returning to app origin</main>' });
    if (path === '/next') return route.fulfill({ contentType: 'text/html', body: '<main>Provider reached</main>' });
    if (path === '/login' || path === '/oauth/consent' || path === '/auth/start') return route.fulfill({ contentType: 'text/html', body: html });
    return route.fulfill({ status: 204, body: '' });
  });
  return { authorizationCalls: () => authorizationCalls, otpCalls: () => otpCalls };
}

test.use({ viewport: { width: 430, height: 932 }, locale: 'zh-CN' });

test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) {
    await info.attach('auth-diagnostics.json', {
      body: JSON.stringify(await page.evaluate(() => (window as any).__diagnostics ?? [])),
      contentType: 'application/json',
    });
  }
});

for (const failure of ['network', 'timeout']) {
test(`temporary session ${failure} has a same-page retry, without another OTP`, async ({ page }) => {
  // A normal authorization response must not inherit an artificial 100ms session deadline.
  const network = await fixture(page, true, false, 150);
  if (failure === 'timeout') await page.clock.install();
  await page.goto(`https://app.musuw.com/oauth/consent?authorization_id=authorization_1&fail_session=${failure}`);
  if (failure === 'timeout') {
    await page.waitForFunction(() => (window as any).__sessionCheckStarted === true);
    await page.clock.fastForward(30_001);
  }
  await expect(page.getByRole('alert')).toContainText('暂时无法确认登录状态');
  await expect(page.locator('input[name="password"]')).toHaveCount(0);
  expect(network.authorizationCalls()).toBe(0);
  await page.getByRole('button', { name: /^重试/ }).click();
  await expect(page.getByText('Callback reached')).toBeVisible();
  expect(network.authorizationCalls()).toBe(1);
  expect(network.otpCalls()).toBe(0);
});
}

test('OTP rate limit shows accurate feedback and disables repeated sends', async ({ page }) => {
  const network = await fixture(page, false, true);
  await page.goto('https://app.musuw.com/login');
  await page.getByRole('button', { name: '邮箱验证码登录' }).click();
  await page.getByLabel('邮箱', { exact: true }).fill('fixture@example.test');
  await page.getByRole('button', { name: /^发送验证码/ }).click();
  await expect(page.getByRole('alert')).toContainText('请求过于频繁');
  await expect(page.getByRole('button', { name: /秒后可重新发送/ })).toBeDisabled();
  expect(network.otpCalls()).toBe(1);
  await page.clock.install();
  await page.clock.fastForward(60_001);
  await expect(page.getByRole('button', { name: /^发送验证码/ })).toBeEnabled();
});

for (const loseTabStorage of [false, true]) {
  test(`real SDK completes OTP login after document navigation with tab storage ${loseTabStorage ? 'lost' : 'preserved'}`, async ({ page }) => {
    const network = await fixture(page, false);
    await page.goto('https://app.musuw.com/login');
    await page.getByRole('button', { name: '邮箱验证码登录' }).click();
    await page.getByLabel('邮箱', { exact: true }).fill('fixture@example.test');
    await page.getByRole('button', { name: /^发送验证码/ }).click();
    await page.locator('#email-code').fill('123456');
    await page.getByRole('button', { name: /^验证并继续/ }).click();
    await expect(page.getByText('Provider reached')).toBeVisible();
    await page.goto('https://app.musuw.com/fixture-transition');
    expect(await page.evaluate(() => localStorage.getItem('musnow.supabase.pkce') !== null)).toBe(true);
    expect(await page.evaluate(() => sessionStorage.getItem('musnow.supabase.pkce'))).toBeNull();
    if (loseTabStorage) await page.evaluate(() => sessionStorage.clear());
    await page.goto('https://app.musuw.com/oauth/consent?authorization_id=authorization_1');
    await expect(page.getByText('Callback reached')).toBeVisible();
    expect(network.authorizationCalls()).toBe(1);
    expect(network.otpCalls()).toBe(1);
  });
}

for (const legacySession of [false, true]) {
  test(`missing shared session requires login even when legacy tab session is ${legacySession ? 'present' : 'absent'}`, async ({ page }) => {
    const network = await fixture(page, false);
    if (legacySession) {
      await page.addInitScript(session => sessionStorage.setItem('musnow.supabase.pkce', JSON.stringify(session)), session);
    }
    await page.goto('https://app.musuw.com/oauth/consent?authorization_id=authorization_1');
    await expect(page.locator('input[name="password"]')).toBeVisible();
    expect(network.authorizationCalls()).toBe(0);
    expect(network.otpCalls()).toBe(0);
    expect(await page.evaluate(() => (window as any).__diagnostics)).toEqual(expect.arrayContaining([
      expect.objectContaining({ phase: 'auth.session_state', reason: 'session_missing' }),
    ]));
    expect(await page.evaluate(() => localStorage.getItem('musnow.supabase.pkce'))).toBeNull();
  });
}

test('blocked browser storage reports unavailable without authorizing or silently using another identity', async ({ page }) => {
  const network = await fixture(page, false, false, 0, true);
  await page.goto('https://app.musuw.com/oauth/consent?authorization_id=authorization_1');
  await expect(page.getByRole('alert')).toContainText('暂时无法确认登录状态');
  await expect(page.locator('input[name="password"]')).toHaveCount(0);
  expect(network.authorizationCalls()).toBe(0);
  expect(network.otpCalls()).toBe(0);
  expect(await page.evaluate(() => (window as any).__diagnostics)).toEqual(expect.arrayContaining([
    expect.objectContaining({ phase: 'auth.session_state', reason: 'session_unavailable' }),
  ]));
});
