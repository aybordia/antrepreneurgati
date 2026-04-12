import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      // Chrome's Web Speech API uses cross-origin postMessage internally.
      // The default strict COOP policy blocks it — unsafe-none allows it.
      "Cross-Origin-Opener-Policy": "unsafe-none",
    },
  },
})
