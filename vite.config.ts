import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
  build: {
    chunkSizeWarningLimit: 1000, // Augmenter la limite pour éviter les avertissements mineurs
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        // Ensure React is loaded before any chunks that depend on it
        manualChunks(id) {
          // Vérifier si le chemin contient node_modules
          const isNodeModule = id.includes('node_modules/');
          
          // Tous les packages React et dépendants
          if (id.includes('node_modules/react') || 
              id.includes('node_modules/react-dom') || 
              id.includes('node_modules/react-router') ||
              id.includes('node_modules/@babel/runtime') ||
              id.includes('node_modules/scheduler') ||
              id.includes('node_modules/prop-types') ||
              id.includes('node_modules/lucide-react') ||
              id.includes('node_modules/@remix-run')) {
            return 'vendor-react';
          }
          
          // Context et components React - toujours inclure dans le vendor-react
          if (!isNodeModule && (
              id.includes('/src/context/') || 
              id.includes('/src/components/'))) {
            return 'vendor-react';
          }
          
          // Firebase
          if (id.includes('node_modules/firebase')) {
            return 'vendor-firebase';
          }
          
          // Date-fns
          if (id.includes('node_modules/date-fns')) {
            return 'vendor-date';
          }
          
          // PDF et exports
          if (id.includes('node_modules/jspdf') || 
              id.includes('node_modules/jszip') || 
              id.includes('node_modules/html2canvas') ||
              id.includes('node_modules/xlsx')) {
            return 'vendor-export';
          }
          
          // Désactiver la séparation en chunks pour les pages pour éviter les problèmes JSX
          // Nous allons plutôt utiliser React.lazy et Suspense dans l'application
          // pour le code splitting au niveau des routes
        }
      }
    }
  }
});
