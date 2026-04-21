import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    /** Слушать все интерфейсы: на Windows снимает часть проблем с localhost / IPv6. */
    host: true,
    /** Чтобы не открывали localhost:3000 (там API), думая что это сайт. */
    open: true,
  },
})
