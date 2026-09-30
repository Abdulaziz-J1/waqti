// Generates every icon size from the one original mark, build/icon.svg:
//   build/icon.png (512), build/icon.ico (16–256), resources/icon.png (256),
//   resources/tray.png (16) and resources/tray@2x.png (32).
// The logo inside the app (NavIcons LogoMark) draws the same shapes.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import pngToIco from 'png-to-ico'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const build = path.join(root, 'build')
const resources = path.join(root, 'resources')
fs.mkdirSync(resources, { recursive: true })

function render(svgFile, size) {
  const svg = fs.readFileSync(svgFile, 'utf8')
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: size }, background: 'rgba(0,0,0,0)' })
  return r.render().asPng()
}

const icon = path.join(build, 'icon.svg')

fs.writeFileSync(path.join(build, 'icon.png'), render(icon, 512))
fs.writeFileSync(path.join(resources, 'icon.png'), render(icon, 256))
fs.writeFileSync(path.join(resources, 'tray.png'), render(icon, 16))
fs.writeFileSync(path.join(resources, 'tray@2x.png'), render(icon, 32))

const icoSizes = [16, 24, 32, 48, 64, 128, 256]
const ico = await pngToIco(icoSizes.map((s) => render(icon, s)))
fs.writeFileSync(path.join(build, 'icon.ico'), ico)

console.log(
  'icons written:',
  [
    'build/icon.png',
    'build/icon.ico',
    'resources/icon.png',
    'resources/tray.png',
    'resources/tray@2x.png'
  ].join(', ')
)
