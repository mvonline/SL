import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages project site: /repo-name/ (set via VITE_BASE_URL in CI)
  base: process.env.VITE_BASE_URL || '/',
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    port: 5173,
    host: '0.0.0.0'
  }
})
