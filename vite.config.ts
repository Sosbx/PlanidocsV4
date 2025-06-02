import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Force le mode classic JSX transform pour éviter les problèmes de runtime
      jsxRuntime: 'automatic'
    }),
    visualizer({
      open: false,
      gzipSize: true,
      brotliSize: true,
      filename: 'dist/stats.html'
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  // Optimisation des dépendances
  optimizeDeps: {
    // Force l'inclusion de toutes les dépendances React
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-router-dom',
      '@remix-run/router',
      'zod'
    ],
    // Force le pre-bundling
    force: true
  },
  build: {
    // Augmenter la limite pour éviter les warnings
    chunkSizeWarningLimit: 500,
    // Désactiver le source map en production
    sourcemap: false,
    // Optimisations supplémentaires
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    // Configuration Rollup
    rollupOptions: {
      output: {
        // Stratégie de chunking optimisée avec fonction
        manualChunks(id) {
          // Skip les fichiers qui ne sont pas des node_modules
          if (!id.includes('node_modules')) {
            return;
          }
          
          // Firebase dans un chunk séparé
          if (id.includes('firebase/')) {
            return 'firebase';
          }
          
          // React et ses dépendances
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
            return 'react';
          }
          
          // Bibliothèques de date
          if (id.includes('date-fns') || id.includes('date-holidays')) {
            return 'date-utils';
          }
          
          // Bibliothèques d'export
          if (id.includes('jspdf') || id.includes('exceljs') || id.includes('jszip')) {
            return 'export-utils';
          }
          
          // UI Libraries
          if (id.includes('framer-motion') || id.includes('lucide-react') || id.includes('react-toastify')) {
            return 'ui-libs';
          }
          
          // Autres vendors
          return 'vendor';
        },
        // Assurer que les imports sont corrects
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    },
    // Compatibilité navigateur
    target: 'es2015'
  },
  // Server config pour le développement
  server: {
    port: 5173,
    host: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'unsafe-none'
    }
  }
});