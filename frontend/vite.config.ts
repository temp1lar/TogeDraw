import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://localhost:5085',
        changeOrigin: true,
      },
      '/boardHub': {
        target: 'http://localhost:5085',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})