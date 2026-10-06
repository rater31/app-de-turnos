import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { copyFileSync, existsSync } from 'node:fs'

// El repo se publica en dos plataformas con rutas distintas:
//
//   Netlify  -> el sitio vive en la raiz del dominio, asi que base = "/"
//   Pages    -> el sitio vive en https://<user>.github.io/<repo>/, asi que
//               base = "/<repo>/"
//
// `base` no se puede dejar fijo: con "/" en Pages el HTML pediria
// /assets/... en vez de /<repo>/assets/... y daria 404. Se lee de APP_BASE_PATH
// para no hornear un path de Pages en el bundle de Netlify. La SPA ya se
// amolda sola: App.tsx usa basename={import.meta.env.BASE_URL}.
//
// Netlify resuelve el fallback de rutas de SPA con public/_redirects, que es
// una directiva suya y que Pages ignora. Pages necesita un 404.html que sea
// una copia de index.html: si no, /admin da 404 y el admin no abre nunca.
// Este plugin lo escribe solo, y solo cuando base no es "/" (o sea, solo para
// Pages), para no cambiarle ni un byte al deploy de Netlify.
function spaFallback404(): Plugin {
  return {
    name: 'turnos:spa-fallback-404',
    apply: 'build',
    closeBundle() {
      if (base === '/') return
      const out = path.resolve(__dirname, 'out')
      const index = path.join(out, 'index.html')
      if (!existsSync(index)) return
      copyFileSync(index, path.join(out, '404.html'))
    },
  }
}

const base = process.env.APP_BASE_PATH || '/'

export default defineConfig(() => ({
  base,
  plugins: [react(), tailwindcss(), spaFallback404()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    outDir: 'out',
    sourcemap: false,
  },
  server: {
    port: 3000,
  },
}))