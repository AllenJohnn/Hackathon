import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  },
  // Tells Vite to safely compile files regardless of slight casing variations
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.jsx?$/
  }
})