import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './styles/BadgeStyles.css';

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
  
  console.log = (...args) => {
    if (!filterCOOP(originalLog, args)) {
      originalLog.apply(console, args);
    }
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
