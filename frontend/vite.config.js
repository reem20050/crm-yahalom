import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
<<<<<<< HEAD
=======
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 5173,
    strictPort: false,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: false,
    allowedHosts: [
      'crm-yahalom-production.up.railway.app',
      '.railway.app',
    ],
  },
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95
})
