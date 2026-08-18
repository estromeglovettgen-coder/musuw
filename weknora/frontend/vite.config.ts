import { fileURLToPath, URL } from 'node:url'
import { resolve, dirname } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { defineConfig, transformWithEsbuild, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { compileScript, parse } from '@vue/compiler-sfc'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const pkg = require('./package.json') as { version?: string }
const FRONTEND_VERSION = pkg.version ?? 'unknown'

function resolveFrontendCommit(): string {
  const fromEnv = process.env.VITE_FRONTEND_COMMIT || process.env.GITHUB_SHA
  if (fromEnv) {
    return fromEnv.slice(0, 7)
  }
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'unknown'
  }
}

const FRONTEND_COMMIT = resolveFrontendCommit()

/**
 * Compile frozen pre-rebuild SFCs as headless controller modules.
 *
 * Files under src/assets/business-baselines are source snapshots used only to
 * preserve the original `<script setup>` behavior. This pre-plugin intercepts
 * their normal `.vue` imports before @vitejs/plugin-vue, compiles the script
 * with `inlineTemplate: false`, and therefore never loads their legacy template
 * or styles into the runtime bundle.
 */
function businessControllerPlugin(): Plugin {
  const baselineMarker = '/src/assets/business-baselines/'

  return {
    name: 'musuw-business-controller',
    enforce: 'pre',
    async load(id) {
      const normalizedId = id.replaceAll('\\', '/')
      if (!normalizedId.includes(baselineMarker) || !normalizedId.endsWith('.pre-view.vue')) {
        return null
      }

      const source = readFileSync(id, 'utf8')
      const { descriptor, errors } = parse(source, { filename: id })
      if (errors.length) {
        throw new Error(`Failed to parse business controller ${id}: ${errors.join('\n')}`)
      }
      if (!descriptor.scriptSetup) {
        throw new Error(`Business controller ${id} must contain <script setup>.`)
      }

      const scopeId = createHash('sha256').update(id).digest('hex').slice(0, 8)
      const compiled = compileScript(descriptor, {
        id: scopeId,
        inlineTemplate: false,
      })
      const transformed = await transformWithEsbuild(compiled.content, id, {
        loader: descriptor.scriptSetup.lang === 'ts' ? 'ts' : 'js',
        target: 'esnext',
        sourcemap: false,
      })
      return transformed.code
    },
  }
}

/** Dev parity with nginx: serve embed.html for /embed/:channelId (not the main SPA). */
function embedHtmlDevFallback(): Plugin {
  return {
    name: 'embed-html-dev-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const raw = req.url ?? ''
        const qIdx = raw.indexOf('?')
        const path = qIdx >= 0 ? raw.slice(0, qIdx) : raw
        const qs = qIdx >= 0 ? raw.slice(qIdx) : ''
        if (path.startsWith('/embed/') && path !== '/embed.html' && !path.includes('.')) {
          req.url = `/embed.html${qs}`
        }
        next()
      })
    },
  }
}
const DEV_PROXY_TARGET =
  process.env.VITE_DEV_PROXY_TARGET ||
  process.env.FRONTEND_BACKEND_URL ||
  'http://localhost:8080'

// The retained Google/email shell is a separate Vite app in development but
// remains same-origin through this standard Vite proxy.  It is opt-in so
// upstream standalone frontend development keeps its original topology.
const AUTH_DEV_TARGET = process.env.VITE_AUTH_DEV_TARGET

function resolveVueOfficePptxEntry(): string {
  try {
    const pkgDir = dirname(require.resolve('@vue-office/pptx/package.json'))
    const candidates = [
      resolve(pkgDir, 'lib/v3/index.js'),
      resolve(pkgDir, 'lib/index.js'),
      resolve(pkgDir, 'lib/v3/vue-office-pptx.mjs'),
    ]
    const matched = candidates.find((candidate) => existsSync(candidate))
    return matched ?? '@vue-office/pptx'
  } catch {
    return '@vue-office/pptx'
  }
}

export default defineConfig({
  define: {
    __FRONTEND_VERSION__: JSON.stringify(FRONTEND_VERSION),
    __FRONTEND_COMMIT__: JSON.stringify(FRONTEND_COMMIT),
  },
  build: {
    modulePreload: {
      resolveDependencies(_filename, deps, { hostId }) {
        // Embed iframe bootstraps with token exchange only; defer heavy chat chunks.
        if (hostId?.includes('embed')) {
          return deps.filter((dep) => !(
            dep.includes('vendor-mermaid')
            || dep.includes('vendor-highlight')
            || dep.includes('vendor-markdown')
            || dep.includes('vendor-tdesign')
            || dep.includes('botmsg')
            || dep.includes('usermsg')
            || dep.includes('EmbedBotMessage')
            || dep.includes('EmbedUserMessage')
            || dep.includes('AgentStreamDisplay')
            || dep.includes('EmbedChatCore')
            || dep.includes('vendor-markdown')
            || dep.includes('fonts-')
          ))
        }
        return deps
      },
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        embed: resolve(__dirname, 'embed.html'),
      },
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('mermaid') || id.includes('/dagre') || id.includes('cytoscape')) {
            return 'vendor-mermaid'
          }
          if (id.includes('marked') || id.includes('katex')) {
            return 'vendor-markdown'
          }
          if (id.includes('highlight.js')) {
            return 'vendor-highlight'
          }
        },
      },
    },
  },
  plugins: [
    businessControllerPlugin(),
    vue(),
    vueJsx(),
    embedHtmlDevFallback(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@vue-office/pptx': resolveVueOfficePptxEntry(),
    },
  },
  server: {
    port: 5173,
    host: true,
    // 代理配置，用于开发环境
    proxy: {
      '/api': {
        target: DEV_PROXY_TARGET,
        changeOrigin: true,
        secure: false,
      },
      '/files': {
        target: DEV_PROXY_TARGET,
        changeOrigin: true,
        secure: false,
      },
      '/r': {
        target: DEV_PROXY_TARGET,
        changeOrigin: true,
        secure: false,
      },
      ...(AUTH_DEV_TARGET
        ? {
            '/auth': {
              target: AUTH_DEV_TARGET,
              changeOrigin: true,
              secure: false,
              ws: true,
            },
            '/oauth': {
              target: AUTH_DEV_TARGET,
              changeOrigin: true,
              secure: false,
              ws: true,
            },
          }
        : {}),
    }
  },
  // `vite preview` 用生产构建产物(dist)本地起服务，是最接近 release 镜像的环境：
  // 同样的压缩 / 拆包 / CSS 加载顺序，可提前暴露只在生产构建出现的问题
  // （如主题变量被打包顺序覆盖）。用法：npm run build && npm run preview
  preview: {
    port: 4173,
    host: true,
    proxy: {
      '/api': {
        target: DEV_PROXY_TARGET,
        changeOrigin: true,
        secure: false,
      },
      '/files': {
        target: DEV_PROXY_TARGET,
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
