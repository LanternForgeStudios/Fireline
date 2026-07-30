import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Project pages are served from https://<org>.github.io/Fireline/, so
// asset URLs need the repo name as a base path in production.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Fireline/' : '/',
  plugins: [react()],
}))
