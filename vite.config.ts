import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5200,
    strictPort: true,
    // trycloudflare hostnames rotate on every tunnel restart — allow all.
    allowedHosts: true,
  },
})
