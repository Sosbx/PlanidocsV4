import React, { useEffect, useState } from 'react';
import { useServiceWorker } from '../hooks/useServiceWorker';

/**
 * Props pour le gestionnaire de Service Worker
 */
interface ServiceWorkerManagerProps {
  showNotifications?: boolean;
  autoApplyUpdates?: boolean;
}

/**
 * Composant pour gérer le Service Worker
 * Affiche des notifications pour les mises à jour et la connectivité
 */
export const ServiceWorkerManager: React.FC<ServiceWorkerManagerProps> = ({
  showNotifications = true,
  autoApplyUpdates = false
}) => {
  // Temporairement désactivé pour éviter les erreurs
  const isSupported = false;
  const isRegistered = false;
  const isUpdateAvailable = false;
  const isOnline = navigator.onLine;
  const cacheInfo = {};
  const applyUpdate = () => {};

  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);

  // Afficher la bannière de mise à jour
  useEffect(() => {
    if (isUpdateAvailable && showNotifications) {
      if (autoApplyUpdates) {
        console.log('🔄 Application automatique de la mise à jour...');
        applyUpdate();
      } else {
        setShowUpdateBanner(true);
      }
    }
  }, [isUpdateAvailable, showNotifications, autoApplyUpdates, applyUpdate]);

  // Afficher la bannière offline
  useEffect(() => {
    if (!isOnline && showNotifications) {
      setShowOfflineBanner(true);
    } else {
      setShowOfflineBanner(false);
    }
  }, [isOnline, showNotifications]);

  // Gérer l'application manuelle de la mise à jour
  const handleApplyUpdate = () => {
    setShowUpdateBanner(false);
    applyUpdate();
  };

  // Masquer la bannière de mise à jour
  const handleDismissUpdate = () => {
    setShowUpdateBanner(false);
  };

  // Masquer la bannière offline
  const handleDismissOffline = () => {
    setShowOfflineBanner(false);
  };

  // Si le Service Worker n'est pas supporté, ne rien afficher
  if (!isSupported) {
    return null;
  }

  return (
    <>
      {/* Bannière de mise à jour disponible */}
      {showUpdateBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white px-4 py-3 shadow-lg">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="font-medium">Nouvelle version disponible!</p>
                <p className="text-sm text-blue-100">
                  Une mise à jour de l'application est prête à être installée.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleApplyUpdate}
                className="bg-white text-blue-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-50 transition-colors"
              >
                Mettre à jour
              </button>
              <button
                onClick={handleDismissUpdate}
                className="text-blue-100 hover:text-white p-1"
                aria-label="Fermer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bannière mode offline */}
      {showOfflineBanner && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-orange-600 text-white px-4 py-2 shadow-lg">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364" />
                </svg>
              </div>
              <p className="text-sm font-medium">
                Mode hors ligne - Les données en cache sont utilisées
              </p>
            </div>
            <button
              onClick={handleDismissOffline}
              className="text-orange-100 hover:text-white p-1"
              aria-label="Fermer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Informations de debug en développement */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-3 rounded-lg text-xs shadow-lg max-w-xs">
          <div className="font-semibold mb-2">Service Worker Debug</div>
          <div className="space-y-1">
            <div>Supporté: {isSupported ? '✅' : '❌'}</div>
            <div>Enregistré: {isRegistered ? '✅' : '❌'}</div>
            <div>Mise à jour: {isUpdateAvailable ? '🔄' : '✅'}</div>
            <div>En ligne: {isOnline ? '🌐' : '📵'}</div>
            {Object.keys(cacheInfo).length > 0 && (
              <div className="mt-2">
                <div className="font-semibold">Cache:</div>
                {Object.entries(cacheInfo).map(([name, size]) => (
                  <div key={name} className="ml-2">
                    {name.split('-').pop()}: {size} éléments
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ServiceWorkerManager;