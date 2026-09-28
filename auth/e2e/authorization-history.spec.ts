import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

// Exercise real document history through AuthApp, runtime and Supabase SDK.
// Provider and native HTTP responses are isolated; no real identity or email.
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
    const runtime = createAuthRuntime({config, nativeStorage:localStorage, storage:sessionStorage,
      sharedStorage:localStorage,
      createIdentityClient:()=>createSupabaseIdentityClient(config,localStorage,sessionStorage),
      onDiagnostic:event=>{window.__diagnostics ??= []; window.__diagnostics.push(event)}});
    createRoot(document.getElementById('root')).render(createElement(AuthApp,{runtime}));
  ` }, bundle: true, write: false, format: 'esm', platform: 'browser',
  define: { 'process.env.NODE_ENV': '"production"' },
}).outputFiles[0].text;
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const html = `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>`;
const origin = 'https://app.musuw.com';
const callback = origin + '/api/v1/auth/oidc/callback?code=fixture-code&state=fixture-state';
const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'history-user', exp: 4102444800, role: 'authenticated' })).toString('base64url')}.fixture`;
const session = { access_token: token, refresh_token: 'fixture-refresh', expires_in: 3600, expires_at: 4102444800, token_type: 'bearer', user: { id: 'history-user', aud: 'authenticated', role: 'authenticated', email: 'history@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } };

test.use({ viewport: { width: 430, height: 932 }, locale: 'zh-CN' });
for (const flow of ['already-approved', 'approval-required', 'native-session'] as const) {
  test(`${flow}: Back returns to the source instead of replaying consumed authorization`, async ({ page }) => {
    let consumed = false;
    const requests: string[] = [];
    let authorizationReads = 0;
    let callbacks = 0;
    let passwordLogins = 0;
    let consentApprovals = 0;
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.name));
    await page.addInitScript(nativeSession => {
      localStorage.setItem('locale', 'zh-CN');
      if (nativeSession) localStorage.setItem('weknora_token', 'fixture-native');
    }, flow === 'native-session');
    await page.route('**/*', async route => {
      const path = new URL(route.request().url()).pathname;
      requests.push(route.request().method() + ' ' + path);
      const json = (value: unknown, status = 200) => route.fulfill({ status, json: value });
      // Playwright routing can follow a fulfilled 302 outside the handler. A
      // replacing document redirect keeps equivalent history without live traffic.
      const redirect = (location: string) => route.fulfill({ contentType: 'text/html', body: `<script>location.replace(${JSON.stringify(location)})</script>` });
      if (path === '/source') return route.fulfill({ contentType: 'text/html', body: '<h1>Source page</h1><a href="/auth/start">Sign in</a>' });
      if (path === '/fixture.js') return route.fulfill({ contentType: 'text/javascript', body: bundle });
      if (path === '/auth/start' || path === '/oauth/consent') return route.fulfill({ contentType: 'text/html', body: html });
      if (path === '/') return route.fulfill({ contentType: 'text/html', body: '<h1>Workspace</h1>' });
      if (path === '/api/v1/auth/me') return json({ success: true });
      if (path === '/auth/v1/user') return json(session.user);
      if (path === '/auth/v1/token') { passwordLogins++; return json(session); }
      if (path === '/api/v1/auth/oidc/url') return json({ success: true, authorization_url: 'https://identity.example/auth/v1/oauth/authorize?state=fixture-state' });
      if (path === '/auth/v1/oauth/authorize') return redirect(origin + '/oauth/consent?authorization_id=history_authorization');
      if (path === '/auth/v1/oauth/authorizations/history_authorization') {
        authorizationReads++;
        if (consumed) return json({ code: 'authorization_not_found', message: 'Already consumed' }, 404);
        if (flow === 'already-approved') return json({ redirect_url: callback });
        return json({ authorization_id: 'history_authorization', client: { id: 'weknora-client', name: 'Musuw', uri: '', logo_uri: '' }, redirect_uri: origin + '/api/v1/auth/oidc/callback', scope: 'openid email profile' });
      }
      if (path === '/auth/v1/oauth/authorizations/history_authorization/consent') { consentApprovals++; return json({ redirect_url: callback }); }
      if (path === '/api/v1/auth/oidc/callback') { callbacks++; consumed = true; return redirect(origin + '/'); }
      return route.fulfill({ status: 204, body: '' });
    });
    await page.goto(origin + '/source');
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    if (flow !== 'native-session') {
      await page.locator('input[name="email"]').fill('history@example.test');
      await page.locator('input[name="password"]').fill('FixturePassword1');
      await page.locator('form.auth-form button[type="submit"]').click();
    }
    try {
      await expect(page.getByRole('heading', { name: 'Workspace', exact: true })).toBeVisible();
    } catch (error) {
      await test.info().attach('history-fixture-diagnostics', { contentType:'application/json', body: JSON.stringify({requests, errors, diagnostic:await page.evaluate(()=>(window as any).__diagnostics ?? [])}) });
      throw error;
    }
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(origin + '/source');
    await expect(page.getByRole('heading', { name: 'Source page', exact: true })).toBeVisible();
    expect(authorizationReads).toBe(flow === 'native-session' ? 0 : 1);
    expect(callbacks).toBe(flow === 'native-session' ? 0 : 1);
    expect(passwordLogins).toBe(flow === 'native-session' ? 0 : 1);
    expect(consentApprovals).toBe(flow === 'approval-required' ? 1 : 0);
    expect(errors).toEqual([]);
  });
}
