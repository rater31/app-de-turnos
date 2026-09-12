import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Si usás un dominio custom (no https://<user>.github.io/<repo>), cambiá `base` a "/".
export default defineConfig({
  base: '/app-de-turnos/',
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
})
