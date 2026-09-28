import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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

async function fixture(page: Page, seedSession = true, rateLimited = false, authorizationDelayMs = 0, blockStorage = false,
  faults: { oidcFailures?: number; invalidOtp?: boolean; signupConfirmation?: boolean;
    authorizationFailure?: { phase: 'details' | 'approve'; status: 503 | 404 } } = {}) {
  let authorizationCalls = 0;
  let approvalCalls = 0;
  let otpCalls = 0;
  let verifyCalls = 0;
  let oidcCalls = 0;
  let passwordCalls = 0;
  let signupCalls = 0;
  let passwordUpdates = 0;
  let nativeSessionCalls = 0;
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
    if (path === '/auth/v1/verify') {
      verifyCalls++;
      return faults.invalidOtp || verifyCalls > 1
        ? json({ code: 'otp_expired', msg: 'Invalid or consumed code' }, 403) : json(session);
    }
    if (path === '/auth/v1/token') { passwordCalls++; return json(session); }
    if (path === '/auth/v1/signup') {
      signupCalls++;
      return json(faults.signupConfirmation ? { user: session.user, session: null } : session);
    }
    if (path === '/auth/v1/user') {
      if (route.request().method() === 'PUT') passwordUpdates++;
      return json(session.user);
    }
    if (path === '/api/v1/auth/oidc/url') {
      oidcCalls++;
      return oidcCalls <= (faults.oidcFailures ?? 0) ? json({ error: 'Temporary fixture outage' }, 503)
        : json({ success: true, authorization_url: 'https://identity.example/next?state=fixture-state' });
    }
    if (path === '/api/v1/auth/me') { nativeSessionCalls++; return json({ success: true }); }
    if (path === '/') return route.fulfill({ contentType: 'text/html', body: '<main>Older native account workspace</main>' });
    if (path === '/auth/v1/oauth/authorizations/authorization_1') {
      authorizationCalls++;
      if (faults.authorizationFailure?.phase === 'details' && authorizationCalls === 1) {
        return json({ code: 'synthetic_authorization_failure' }, faults.authorizationFailure.status);
      }
      if (authorizationDelayMs) await new Promise(resolve => setTimeout(resolve, authorizationDelayMs));
      return json({ authorization_id: 'authorization_1', client: { id: 'weknora-client', name: 'Musuw', uri: '', logo_uri: '' }, redirect_uri: 'https://app.musuw.com/api/v1/auth/oidc/callback', scope: 'openid email profile' });
    }
    if (path === '/auth/v1/oauth/authorizations/authorization_1/consent') {
      approvalCalls++;
      if (faults.authorizationFailure?.phase === 'approve' && approvalCalls === 1) {
        return json({ code: 'synthetic_authorization_failure' }, faults.authorizationFailure.status);
      }
      return json({ redirect_url: 'https://app.musuw.com/api/v1/auth/oidc/callback?code=fixture-code&state=fixture-state' });
    }
    if (path === '/api/v1/auth/oidc/callback') return route.fulfill({ contentType: 'text/html', body: '<main>Callback reached</main>' });
    if (path === '/fixture-transition') return route.fulfill({ contentType: 'text/html', body: '<main>Returning to app origin</main>' });
    if (path === '/next') return route.fulfill({ contentType: 'text/html', body: '<main>Provider reached</main>' });
    if (path === '/login' || path === '/oauth/consent' || path === '/auth/start' || path === '/auth/recovery') return route.fulfill({ contentType: 'text/html', body: html });
    return route.fulfill({ status: 204, body: '' });
  });
  return { authorizationCalls: () => authorizationCalls, otpCalls: () => otpCalls,
    verifyCalls: () => verifyCalls, oidcCalls: () => oidcCalls, passwordCalls: () => passwordCalls,
    signupCalls: () => signupCalls, passwordUpdates: () => passwordUpdates, approvalCalls: () => approvalCalls,
    nativeSessionCalls: () => nativeSessionCalls };
}

test.use({ viewport: { width: 430, height: 932 }, locale: 'zh-CN' });

test('verified OTP resumes a failed connection without consuming the code again', async ({ page }) => {
  const network = await fixture(page, false, false, 0, false, { oidcFailures: 2 });
  await page.goto('https://app.musuw.com/auth/start');
  await page.getByRole('button', { name: '邮箱验证码登录' }).click();
  await page.getByLabel('邮箱', { exact: true }).fill('fixture@example.test');
  await page.getByRole('button', { name: /^发送验证码/ }).click();
  await page.locator('#email-code').fill('123456');
  await page.getByRole('button', { name: /^验证并继续/ }).click();
  await expect(page.getByRole('alert')).toContainText('验证已通过，连接暂时失败');
  await expect(page.locator('input[name="code"], input[name="password"]')).toHaveCount(0);
  await page.getByRole('button', { name: /^重试/ }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('input[name="code"], input[name="password"]')).toHaveCount(0);
  await page.getByRole('button', { name: /^重试/ }).click();
  await expect(page.getByText('Provider reached')).toBeVisible();
  expect(network.otpCalls()).toBe(1);
  expect(network.verifyCalls()).toBe(1);
  expect(network.oidcCalls()).toBe(3);
});

test('verified identity retry cannot return to an older native account from another tab', async ({ page, context }) => {
  const olderTab = await context.newPage();
  await olderTab.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<main>Older account tab</main>' }));
  await olderTab.goto('https://app.musuw.com/fixture-transition');
  await olderTab.evaluate(() => localStorage.setItem('weknora_token', 'synthetic-older-account-native-token'));
  const network = await fixture(page, false, false, 0, false, { oidcFailures: 1 });
  await page.goto('https://app.musuw.com/login');
  await page.getByLabel('邮箱', { exact: true }).fill('fixture@example.test');
  await page.getByLabel('密码', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: /^登录/ }).click();
  await expect(page.getByRole('alert')).toContainText('验证已通过，连接暂时失败');
  await page.getByRole('button', { name: /^重试/ }).click();
  await expect(page.getByText('Provider reached')).toBeVisible();
  expect(network.passwordCalls()).toBe(1);
  expect(network.oidcCalls()).toBe(2);
  expect(network.nativeSessionCalls()).toBe(0);
  expect(await olderTab.evaluate(() => localStorage.getItem('weknora_token')))
    .toBe('synthetic-older-account-native-token');
});

for (const action of ['password', 'signup', 'signup code', 'password recovery'] as const) {
  test(`${action} resumes a failed connection without repeating the successful identity operation`, async ({ page }) => {
    const recovery = action === 'password recovery';
    const network = await fixture(page, recovery, false, 0, false,
      { oidcFailures: 1, signupConfirmation: action === 'signup code' });
    if (recovery) {
      await page.addInitScript(fingerprint => {
        sessionStorage.setItem('musnow.auth.password-recovery', JSON.stringify({
          createdAt: Date.now(), sessionFingerprint: fingerprint,
        }));
      }, createHash('sha256').update(token).digest('hex'));
    }
    await page.goto(`https://app.musuw.com/${recovery ? 'auth/recovery' : 'auth/start'}`);
    if (!recovery) {
      if (action !== 'password') await page.getByRole('button', { name: '创建账号', exact: true }).click();
      await page.getByLabel('邮箱', { exact: true }).fill('fixture@example.test');
    }
    await page.getByLabel('密码', { exact: true }).fill('fixture-password');
    if (action !== 'password') await page.getByLabel('确认密码', { exact: true }).fill('fixture-password');
    await page.getByRole('button', { name: recovery ? /^更新密码/ : action === 'password' ? /^登录/ : /^创建账号/ }).click();
    if (action === 'signup code') {
      await page.locator('#registration-confirmation-code').fill('123456');
      await page.getByRole('button', { name: /^确认邮箱/ }).click();
    }
    await expect(page.getByRole('alert')).toContainText('验证已通过，连接暂时失败');
    await expect(page.locator('input')).toHaveCount(0);
    await page.getByRole('button', { name: /^重试/ }).click();
    await expect(page.getByText('Provider reached')).toBeVisible();
    expect(network.passwordCalls()).toBe(action === 'password' ? 1 : 0);
    expect(network.signupCalls()).toBe(action.startsWith('signup') ? 1 : 0);
    expect(network.verifyCalls()).toBe(action === 'signup code' ? 1 : 0);
    expect(network.passwordUpdates()).toBe(recovery ? 1 : 0);
    expect(network.otpCalls()).toBe(0);
    expect(network.oidcCalls()).toBe(2);
  });
}

test('invalid OTP stays on its form without offering a verified-session retry', async ({ page }) => {
  const network = await fixture(page, false, false, 0, false, { invalidOtp: true });
  await page.goto('https://app.musuw.com/auth/start');
  await page.getByRole('button', { name: '邮箱验证码登录' }).click();
  await page.getByLabel('邮箱', { exact: true }).fill('fixture@example.test');
  await page.getByRole('button', { name: /^发送验证码/ }).click();
  await page.locator('#email-code').fill('123456');
  await page.getByRole('button', { name: /^验证并继续/ }).click();
  await expect(page.getByRole('alert')).toHaveText('验证码无效，请重新输入。');
  await expect(page.locator('#email-code')).toBeVisible();
  await expect(page.getByRole('button', { name: /^重试/ })).toHaveCount(0);
  expect(network.oidcCalls()).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('musnow.supabase.pkce'))).toBeNull();
});

for (const phase of ['details', 'approve'] as const) {
  for (const status of [503, 404] as const) {
    test(`authorization ${phase} HTTP ${status} ${status === 503 ? 'can resume' : 'fails closed'}`, async ({ page }) => {
      const network = await fixture(page, true, false, 0, false, { authorizationFailure: { phase, status } });
      await page.goto('https://app.musuw.com/oauth/consent?authorization_id=authorization_1');
      if (status === 503) {
        await expect(page.getByRole('alert')).toContainText('暂时无法确认登录状态');
        await expect(page.locator('input[name="password"]')).toHaveCount(0);
        await page.getByRole('button', { name: /^重试/ }).click();
        await expect(page.getByText('Callback reached')).toBeVisible();
        expect(network.authorizationCalls()).toBe(2);
        expect(network.approvalCalls()).toBe(phase === 'approve' ? 2 : 1);
      } else {
        await expect(page.getByRole('alert')).toHaveText('无法继续授权，请重新开始。');
        await expect(page.locator('input[name="password"]')).toBeVisible();
        await expect(page.getByRole('button', { name: /^重试/ })).toHaveCount(0);
        expect(network.authorizationCalls()).toBe(1);
        expect(network.approvalCalls()).toBe(phase === 'approve' ? 1 : 0);
      }
      expect(network.otpCalls()).toBe(0);
      expect(network.passwordCalls()).toBe(0);
    });
  }
}

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
