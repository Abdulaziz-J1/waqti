import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

const alias = {
  '@shared': resolve(__dirname, 'src/shared'),
  '@renderer': resolve(__dirname, 'src/renderer/src')
}

/**
 * Injects the Content-Security-Policy meta tag. Production is strict
 * (`script-src 'self'`); dev adds what the Vite client and React refresh need.
 */
function cspPlugin(isDev: boolean): Plugin {
  const prod = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self' data:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'"
  ]
  const dev = prod.map((d) => {
    if (d.startsWith('script-src')) return "script-src 'self' 'unsafe-inline'"
    if (d.startsWith('connect-src')) return "connect-src 'self' ws://localhost:* http://localhost:*"
    return d
  })
  const policy = (isDev ? dev : prod).join('; ')
  return {
    name: 'waqti-csp',
    transformIndexHtml(html) {
      return html.replace(
        '<!-- CSP -->',
        `<meta http-equiv="Content-Security-Policy" content="${policy}" />`
      )
    }
  }
}

export default defineConfig(({ command }) => ({
  main: {
    resolve: { alias },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') }
      }
    }
  },
  preload: {
    resolve: { alias },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: { alias },
    plugins: [react(), cspPlugin(command === 'serve')],
    build: {
      target: 'chrome140',
      assetsInlineLimit: 0,
      minify: true,
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          overlay: resolve(__dirname, 'src/renderer/overlay.html')
        }
      }
    }
  }
}))
