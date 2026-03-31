import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          if (id.includes('pixi.js')) return 'vendor-pixi'
          if (id.includes('three/examples')) return 'vendor-three-examples'
          if (id.includes('three/src/renderers') || id.includes('three/build')) return 'vendor-three-renderers'
          if (id.includes('three')) return 'vendor-three-core'
          if (id.includes('@tauri-apps')) return 'vendor-tauri'
          if (id.includes('react-router-dom')) return 'vendor-router'
          if (id.includes('react-dom')) return 'vendor-react-dom'
          if (id.includes('react')) return 'vendor-react'
          if (id.includes('zustand')) return 'vendor-zustand'

          return 'vendor-misc'
        },
      },
    },
  },
})
