import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Force le mode classic JSX transform pour éviter les problèmes de runtime
      jsxRuntime: 'automatic'
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
    chunkSizeWarningLimit: 1000,
    // Désactiver le source map en production
    sourcemap: false,
    // Configuration Rollup
    rollupOptions: {
      output: {
        // Stratégie simple: un seul vendor chunk pour toutes les dépendances
        manualChunks: {
          // Un seul chunk vendor avec TOUTES les dépendances
          vendor: [
            'react',
            'react-dom',
            'react-dom/client',
            'react/jsx-runtime',
            'react/jsx-dev-runtime',
            'react-router-dom',
            '@remix-run/router'
          ]
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
    host: true
  }
});