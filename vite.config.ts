import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Netlify sirve el sitio desde la raiz del dominio, asi que `base` es siempre
// "/". No cambiar a "/<repo>/" como en GitHub Pages: eso hornearia un path
// inexistente en los assets y en el basename del BrowserRouter.
export default defineConfig(() => ({
  base: '/',
  plugins: [react(), tailwindcss()],
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
