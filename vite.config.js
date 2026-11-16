import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    // Split the download into parts that change at different speeds, so a
    // returning player only re-downloads what changed:
    //   three   three.js (~680 kB, changes only when we upgrade it)
    //   r3f     React Three Fiber + drei
    //   story   the story, world and character JSON in src/game/data
    //   index   the game code itself
    chunkSizeWarningLimit: 800, // three.js alone is ~680 kB
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three'
          if (id.includes('/node_modules/@react-three/')) return 'r3f'
          if (id.includes('/src/game/data/')) return 'story'
          return undefined
        },
      },
    },
  },
})
