// Copies the Thmanyah Sans weights Waqti uses out of the official download
// (https://font.thmanyah.com) into fonts/thmanyah. The thmanyah Font License
// forbids redistributing the font files, so they are not committed; at build
// time electron.vite.config.ts inlines them into the CSS bundle.
//
//   npm run fonts                      reads ~/Downloads/Thmanyah-Font-Family.zip
//   npm run fonts -- path/to/file.zip  reads another copy of the official zip
//   npm run fonts -- --check           fails when the files are missing (used by dist)
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = path.join(root, 'fonts', 'thmanyah')
const inZip = 'thmanyah typeface/thmanyahsans/woff2'
const files = ['thmanyahsans-Regular.woff2', 'thmanyahsans-Medium.woff2', 'thmanyahsans-Bold.woff2']

const args = process.argv.slice(2)
const missing = () => files.filter((f) => !fs.existsSync(path.join(target, f)))

if (args.includes('--check')) {
  const gone = missing()
  if (gone.length > 0) {
    console.error(
      `Thmanyah Sans is missing from fonts/thmanyah (${gone.join(', ')}).\n` +
        'Download it from https://font.thmanyah.com and run: npm run fonts'
    )
    process.exit(1)
  }
  console.log('Thmanyah Sans: present')
  process.exit(0)
}

const zip = path.resolve(
  args[0] ?? path.join(os.homedir(), 'Downloads', 'Thmanyah-Font-Family.zip')
)
if (!fs.existsSync(zip)) {
  console.error(`Not found: ${zip}\nDownload the font from https://font.thmanyah.com first.`)
  process.exit(1)
}

// Windows' bundled bsdtar reads zip archives (Git's GNU tar does not).
const systemTar = path.join(process.env['SystemRoot'] ?? 'C:\\Windows', 'System32', 'tar.exe')
const tar = process.platform === 'win32' && fs.existsSync(systemTar) ? systemTar : 'tar'
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'waqti-fonts-'))
try {
  const members = [...files.map((f) => `${inZip}/${f}`), 'LICENSE.pdf']
  const run = spawnSync(tar, ['-xf', zip, '-C', tmp, ...members], { encoding: 'utf8' })
  if (run.status !== 0) {
    console.error(`Could not read ${zip}:\n${run.stderr || run.error?.message}`)
    process.exit(1)
  }
  fs.mkdirSync(target, { recursive: true })
  for (const f of files) fs.copyFileSync(path.join(tmp, inZip, f), path.join(target, f))
  fs.copyFileSync(path.join(tmp, 'LICENSE.pdf'), path.join(target, 'LICENSE.pdf'))
  console.log(`Thmanyah Sans: ${files.length} weights copied to fonts/thmanyah`)
} finally {
  fs.rmSync(tmp, { recursive: true, force: true })
}
