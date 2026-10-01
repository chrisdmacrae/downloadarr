import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0', // Allow external connections (needed for Docker)
    watch: {
      usePolling: true, // Enable polling for file changes in Docker
    },
    // The API serves the built UI itself. In development Vite serves it, and
    // hands the API's routes on to wherever the API is running.
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: process.env.VITE_API_PROXY || 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
