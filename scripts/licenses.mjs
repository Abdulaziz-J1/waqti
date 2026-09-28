// Writes THIRD_PARTY_LICENSES: the licence of every package that ships with
// Waqti — runtime dependencies (packaged in node_modules), everything bundled
// into the renderer (React, Motion, Recharts, Lucide and their dependencies),
// the fallback fonts (SIL OFL 1.1), Electron itself, and a notice for the
// interface font, Thmanyah Sans (thmanyah Font License). Run: npm run licenses
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))

// Packages bundled into the renderer by Vite (dev dependencies that still ship).
const BUNDLED = [
  'react',
  'react-dom',
  'motion',
  'recharts',
  'lucide-react',
  '@fontsource/noto-kufi-arabic',
  '@fontsource/ibm-plex-sans-arabic',
  'electron'
]

// Runtime packages ship on their own (electron-builder.yml whitelists them; their
// install-time tooling is excluded), so their dependency trees are not walked.
const RUNTIME = [
  'adhan',
  'better-sqlite3',
  'get-windows',
  'koffi',
  '@koromix/koffi-win32-x64',
  'zod'
]
const seen = new Map()

function resolveDir(name, fromDir) {
  let dir = fromDir
  while (true) {
    const candidate = path.join(dir, 'node_modules', name, 'package.json')
    if (fs.existsSync(candidate)) return path.dirname(candidate)
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

function visit(name, fromDir, walk) {
  const dir = resolveDir(name, fromDir)
  if (!dir) return
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
  const key = `${meta.name}@${meta.version}`
  if (seen.has(key)) return
  const licenseFile = fs
    .readdirSync(dir)
    .find((f) => /^(licen[sc]e|copying)(\.(md|txt))?$/i.test(f))
  seen.set(key, {
    name: meta.name,
    version: meta.version,
    license: typeof meta.license === 'string' ? meta.license : (meta.license?.type ?? 'see text'),
    text: licenseFile ? fs.readFileSync(path.join(dir, licenseFile), 'utf8').trim() : null
  })
  // Electron's own dependencies are only used to download it; they do not ship.
  if (meta.name === 'electron') return
  if (!walk) return
  for (const dep of Object.keys(meta.dependencies ?? {})) visit(dep, dir, true)
}

for (const name of RUNTIME) visit(name, root, false)
for (const name of BUNDLED) visit(name, root, true)

const entries = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
const header = `THIRD-PARTY LICENSES — وقتي (Waqti) ${pkg.version}

Waqti itself is released under the MIT License (see LICENSE).
It includes the following third-party software. Electron also ships
Chromium's licences in LICENSES.chromium.html next to Waqti.exe.

Fonts: the interface font, Thmanyah Sans, is Copyright (c) thmanyah
Publishing and Distribution (https://thmanyah.com), with Reserved Font Name
"thmanyah", and is used under the thmanyah Font License
(https://font.thmanyah.com/licenses). It is embedded in this application
only; it is not licensed for extraction, reuse or redistribution, and may
only be obtained from https://font.thmanyah.com.
The fallback fonts, Noto Kufi Arabic and IBM Plex Sans Arabic, are licensed
under the SIL Open Font License 1.1 (full text included below with each
package).

${entries.map((e) => `- ${e.name} ${e.version} (${e.license})`).join('\n')}
`

const body = entries
  .map(
    (e) =>
      `\n${'='.repeat(78)}\n${e.name} ${e.version} — ${e.license}\n${'='.repeat(78)}\n\n${e.text ?? `Licensed under ${e.license}.`}\n`
  )
  .join('')

fs.writeFileSync(path.join(root, 'THIRD_PARTY_LICENSES'), header + body)
console.log(`THIRD_PARTY_LICENSES: ${entries.length} packages`)
