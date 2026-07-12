import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget   = env.VITE_API_URL        || 'http://localhost:4000';
  const direxTarget = env.VITE_DIREX_DEV_URL  || 'http://localhost:8000';

  return {
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Game / simulation backend (Node.js)
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
      },
      // DIRE-X scoring backend (FastAPI) — strips /direx prefix before forwarding
      '/direx': {
        target: direxTarget,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/direx/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts'],
          animation: ['framer-motion'],
          state: ['zustand', 'axios'],
          globe: ['react-globe.gl', 'three'],
        },
      },
    },
  },
  }; // end return
}); // end defineConfig
