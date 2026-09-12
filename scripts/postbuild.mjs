// Copia index.html como 404.html para que GitHub Pages sirva la SPA en deep links.
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const outDir = join(process.cwd(), 'out')

try {
  mkdirSync(outDir, { recursive: true })
  copyFileSync(join(outDir, 'index.html'), join(outDir, '404.html'))
  console.log('[postbuild] 404.html generado para GitHub Pages')
} catch (err) {
  console.error('[postbuild] No se pudo copiar 404.html:', err)
  process.exit(1)
}
