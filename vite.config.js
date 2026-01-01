import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  // Use BASE_PATH environment variable, defaulting to '/' (for local development)
  // GitHub Actions sets BASE_PATH to /repo-name/
  base: process.env.BASE_PATH || '/',
})
