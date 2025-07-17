// Configuration du fuseau horaire temporairement désactivée pour corriger la récursion
// import './config/dateConfig';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App.tsx';
import './index.css';
import './styles/BadgeStyles.css';
import { GOOGLE_CLIENT_ID } from './lib/google/googleCalendarConfig';

// Nettoyage des Service Workers problématiques
import './utils/swCleanup';


// Filtrer les avertissements COOP de Firebase Auth en développement
if (import.meta.env.DEV) {
  const originalWarn = console.warn;
  const originalLog = console.log;
  
  // Fonction pour filtrer les messages COOP
  const filterCOOP = (method: any, args: any[]) => {
    const message = args[0]?.toString() || '';
    if (message.includes('Cross-Origin-Opener-Policy')) {
      return true;
    }
    return false;
  };
  
  console.warn = (...args) => {
    if (!filterCOOP(originalWarn, args)) {
      originalWarn.apply(console, args);
    }
  };
}

const root = createRoot(document.getElementById('root')!);

root.render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>
);

