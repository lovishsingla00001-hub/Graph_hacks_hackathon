import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this repository beneath /Graph_hacks_hackathon/.
  base: process.env.GITHUB_ACTIONS === 'true' ? '/Graph_hacks_hackathon/' : '/',
  plugins: [react()],
})
