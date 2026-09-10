import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 2100,
    proxy: {
      '/api': {
        target: 'https://acsdemo.co.in',
        changeOrigin: true,
      }
    }
  }
})
