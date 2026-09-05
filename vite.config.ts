import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves this from https://<org>.github.io/Fireline/, so asset
// URLs need the repo name as a base path there. itch.io extracts the build
// zip into its own CDN path (depth varies per upload), so that target needs
// relative asset paths instead — use `vite build --mode itch` for that one.
export default defineConfig(({ command, mode }) => ({
  base: command !== 'build' ? '/' : mode === 'itch' ? './' : '/Fireline/',
  build: {
    outDir: mode === 'itch' ? 'dist-itch' : 'dist',
  },
  plugins: [react()],
}))
