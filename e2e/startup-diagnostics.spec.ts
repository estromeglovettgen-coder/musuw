import { createServer, type Server } from 'node:http'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const requireFrontend = createRequire(new URL('../weknora/frontend/package.json', import.meta.url))
const { buildSync } = requireFrontend('esbuild')

// Use actual browser Navigation/Resource Timing and real diagnostic modules.
// Only HTTP asset delivery is controlled; no identity or business calls occur.
test('slow module delivery is distinguishable from router work without exposing URLs', async ({ page }) => {
  const module = buildSync({
    stdin: {
      contents: `import '/assets/slow-module-Abcdef12.js?credential=fixture-secret';
        import {startStartupMetrics} from './shared/browser-startup-metrics';
        const timing = startStartupMetrics('app');
        timing.routerStart();
        await new Promise(resolve => setTimeout(resolve, 130));
        timing.routerReady(); timing.mountStart();
        document.body.append(Object.assign(document.createElement('main'), {textContent: 'Ready'}));
        timing.mounted();`,
      resolveDir: fileURLToPath(new URL('../', import.meta.url)),
    },
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', external: ['/assets/*'],
  }).outputFiles[0].text
  const events: Record<string, any>[] = []
  let server: Server | undefined
  try {
    server = createServer((request, response) => {
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
      if (pathname === '/api/v1/client-diagnostics') {
        let body = ''
        request.on('data', chunk => { body += chunk })
        request.on('end', () => { events.push(JSON.parse(body)); response.writeHead(204).end() })
      } else if (pathname === '/assets/main-Abcdef12.js') {
        response.writeHead(200, { 'Content-Type': 'application/javascript' }).end(module)
      } else if (pathname === '/assets/slow-module-Abcdef12.js') {
        setTimeout(() => {
          if (response.destroyed) return
          response.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' })
          response.write('// response started\n')
          setTimeout(() => { if (!response.destroyed) response.end('export const ready = true;') }, 220)
        }, 430)
      } else {
        response.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><script type="module" src="/assets/main-Abcdef12.js"></script>')
      }
    })
    await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw Error('Fixture failed to bind')
    await page.goto(`http://127.0.0.1:${address.port}/platform/knowledge-bases?email=fixture-private`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Ready', { exact: true })).toBeVisible()
    await expect.poll(() => events.some(event => event.resources?.length)).toBe(true)
    const entry = events.find(event => event.phase === 'app.entry')!
    const route = events.find(event => event.phase === 'app.router')!
    const navigation = events.find(event => event.phase === 'app.navigation')!
    const slow = events.flatMap(event => event.resources ?? []).find(resource => resource.name === 'slow-module-Abcdef12.js')!
    expect(entry.duration_ms).toBeGreaterThanOrEqual(600)
    expect(route.duration_ms).toBeGreaterThanOrEqual(100)
    expect(route.duration_ms).toBeLessThan(entry.duration_ms)
    expect(navigation.timings.ttfb_ms).toBeGreaterThanOrEqual(0)
    expect(navigation.timings.download_ms).toBeGreaterThanOrEqual(0)
    expect(slow.duration_ms).toBeGreaterThanOrEqual(600)
    expect(slow.ttfb_ms).toBeGreaterThanOrEqual(350)
    expect(slow.download_ms).toBeGreaterThanOrEqual(150)
    expect(events.every(event => event.document_id && event.flow_id && event.page === 'app')).toBe(true)
    expect(events.every(event => Buffer.byteLength(JSON.stringify(event)) <= 2048)).toBe(true)
    expect(JSON.stringify(events)).not.toMatch(/fixture-secret|fixture-private|credential=|email=|https?:\/\//)
  } finally {
    server?.closeAllConnections()
    await new Promise<void>(resolve => server ? server.close(() => resolve()) : resolve())
  }
})
