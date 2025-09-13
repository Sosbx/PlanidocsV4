import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import viteCompression from 'vite-plugin-compression';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic'
    }),
    visualizer({
      open: false,
      gzipSize: true,
      brotliSize: true,
      filename: 'dist/stats.html'
    }),
    // Compression désactivée temporairement car le plugin a des problèmes
    // TODO: Configurer nginx ou un autre serveur pour la compression en dev
    // Compression gzip et brotli pour la production
    viteCompression({
      verbose: true,
      disable: false,
      threshold: 10240, // Compresser les fichiers > 10KB
      algorithm: 'gzip',
      ext: '.gz'
    }),
    viteCompression({
      verbose: true,
      disable: false,
      threshold: 10240,
      algorithm: 'brotliCompress',
      ext: '.br'
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/components': resolve(__dirname, './src/components'),
      '@/features': resolve(__dirname, './src/features'),
      '@/hooks': resolve(__dirname, './src/hooks'),
      '@/lib': resolve(__dirname, './src/lib'),
      '@/utils': resolve(__dirname, './src/utils'),
      '@/types': resolve(__dirname, './src/types'),
      '@/context': resolve(__dirname, './src/context'),
      '@/styles': resolve(__dirname, './src/styles'),
      '@/pages': resolve(__dirname, './src/pages'),
      // Optimisation date-fns : rediriger vers notre fichier centralisé
      // 'date-fns/locale': resolve(__dirname, './src/utils/dateLocale')
    },
  },
  // Optimisation des dépendances
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-router-dom',
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'date-fns',
      'date-fns/locale/fr'
    ],
    exclude: [
      // Exclure les locales non utilisées de date-fns
      'date-fns/locale/en-US',
      'date-fns/locale/en-GB',
      'date-fns/locale/de',
      'date-fns/locale/es',
      'date-fns/locale/it'
    ]
  },
  build: {
    // Augmenter la limite pour éviter les warnings
    chunkSizeWarningLimit: 1000,
    // Désactiver les source maps en production
    sourcemap: false,
    // Configuration Rollup
    rollupOptions: {
      output: {
        // Optimisation manuelle simple pour React et Firebase
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'date-fns': ['date-fns'],
          'lucide': ['lucide-react']
        }
      },
      // Configuration pour la résolution des modules
      preserveSymlinks: true
    },
    // Compatibilité navigateur moderne
    target: 'es2020'
  },
  // Server config pour le développement
  server: {
    port: 5173,
    host: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'unsafe-none',
      // Headers pour le service worker
      'Service-Worker-Allowed': '/'
    },
    // Configuration pour servir le service worker avec le bon type MIME
    fs: {
      strict: false
    },
    // Activer la compression pour le serveur de développement
    middlewareMode: false
  },
  // Configuration de prévisualisation
  preview: {
    port: 4173,
    host: true,
    // Activer la compression pour le serveur de preview
    compression: true
  },
  // Configuration PWA et Service Worker
  define: {
    __SW_ENABLED__: JSON.stringify(true)
  }
});