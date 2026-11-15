import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// base relative : l'appli fonctionne quel que soit le nom du dépôt GitHub Pages.
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      // GramJS fournit sa propre cryptographie pour navigateur : on l'utilise à la place
      // du module « crypto » de Node (sinon la connexion avec mot de passe 2FA échoue).
      crypto: fileURLToPath(new URL('./node_modules/telegram/crypto/crypto.js', import.meta.url)),
    },
  },
  plugins: [
    react(),
    // GramJS (la bibliothèque Telegram) attend quelques modules Node.js :
    // on fournit leurs équivalents navigateur.
    nodePolyfills({
      include: ['buffer', 'events', 'os', 'path', 'stream', 'util', 'process', 'string_decoder', 'constants'],
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
})
