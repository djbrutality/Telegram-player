import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// base relative : l'appli fonctionne quel que soit le nom du dépôt GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    // GramJS (la bibliothèque Telegram) attend quelques modules Node.js :
    // on fournit leurs équivalents navigateur.
    nodePolyfills({
      include: ['buffer', 'crypto', 'events', 'os', 'path', 'stream', 'util', 'process', 'string_decoder', 'constants'],
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
})
