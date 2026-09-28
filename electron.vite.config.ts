import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
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

const THMANYAH_DIR = resolve(__dirname, 'fonts/thmanyah')
// Serif Display for headings and big numbers (500 also serves 400; 700 serves
// 600), Serif Text for everything else. Keep in step with FILES in scripts/fonts.mjs.
const THMANYAH_FACES = [
  { family: 'Thmanyah Serif Display', file: 'thmanyahserifdisplay-Medium.woff2', weight: 500 },
  { family: 'Thmanyah Serif Display', file: 'thmanyahserifdisplay-Bold.woff2', weight: 700 },
  { family: 'Thmanyah Serif Text', file: 'thmanyahseriftext-Regular.woff2', weight: 400 },
  { family: 'Thmanyah Serif Text', file: 'thmanyahseriftext-Medium.woff2', weight: 500 },
  { family: 'Thmanyah Serif Text', file: 'thmanyahseriftext-Bold.woff2', weight: 700 }
]

/**
 * Serves `virtual:thmanyah.css`: the @font-face rules for the Thmanyah serif
 * fonts with the files inlined as data URIs. The thmanyah Font License allows
 * the font only inside a compiled, packaged product and never as files a user
 * can pull out, and it forbids redistributing them, so the files live outside
 * git (`npm run fonts`) and never ship as separate assets. When they are
 * missing (a fresh clone) the module is empty and the bundled OFL fonts take over.
 */
function thmanyahPlugin(): Plugin {
  const id = 'virtual:thmanyah.css'
  const resolvedId = `\0${id}`
  return {
    name: 'waqti-thmanyah',
    resolveId(source) {
      return source === id ? resolvedId : undefined
    },
    load(source) {
      if (source !== resolvedId) return undefined
      if (!THMANYAH_FACES.every((f) => existsSync(join(THMANYAH_DIR, f.file)))) {
        this.warn(
          'The Thmanyah fonts are not in fonts/thmanyah (npm run fonts); using the bundled fonts.'
        )
        return ''
      }
      return THMANYAH_FACES.map((f) => {
        const data = readFileSync(join(THMANYAH_DIR, f.file)).toString('base64')
        return `@font-face {
  font-family: '${f.family}';
  font-style: normal;
  font-display: block;
  font-weight: ${f.weight};
  src: url(data:font/woff2;base64,${data}) format('woff2');
}`
      }).join('\n')
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
    plugins: [react(), cspPlugin(command === 'serve'), thmanyahPlugin()],
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
