import { useState, useEffect, useCallback } from 'react';

/**
 * Interface pour les informations du Service Worker
 */
export interface ServiceWorkerInfo {
  isSupported: boolean;
  isRegistered: boolean;
  isUpdateAvailable: boolean;
  isOnline: boolean;
  cacheInfo: Record<string, number>;
}

/**
 * Hook pour gérer le Service Worker
 * Gère l'enregistrement, les mises à jour et le cache
 */
export const useServiceWorker = () => {
  const [swInfo, setSwInfo] = useState<ServiceWorkerInfo>({
    isSupported: 'serviceWorker' in navigator,
    isRegistered: false,
    isUpdateAvailable: false,
    isOnline: navigator.onLine,
    cacheInfo: {}
  });

  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Fonction pour enregistrer le Service Worker
  const registerServiceWorker = useCallback(async () => {
    if (!swInfo.isSupported) {
      console.warn('🚫 Service Worker non supporté par ce navigateur');
      return null;
    }

    try {
      // Nettoyer les anciens Service Workers d'abord
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        if (registration.scope !== window.location.origin + '/') {
          console.log('🧹 Nettoyage ancien Service Worker:', registration.scope);
          await registration.unregister();
        }
      }

      console.log('📦 Enregistrement du Service Worker...');
      
      const reg = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none' // Éviter les problèmes de cache
      });

      console.log('✅ Service Worker enregistré avec succès', reg);
      
      setRegistration(reg);
      setSwInfo(prev => ({ ...prev, isRegistered: true }));

      // Écouter les mises à jour
      reg.addEventListener('updatefound', () => {
        console.log('🔄 Mise à jour du Service Worker détectée');
        
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('🆕 Nouvelle version du Service Worker prête');
              setSwInfo(prev => ({ ...prev, isUpdateAvailable: true }));
            }
          });
        }
      });

      return reg;
    } catch (error) {
      console.error('❌ Erreur lors de l\'enregistrement du Service Worker:', error);
      return null;
    }
  }, [swInfo.isSupported]);

  // Fonction pour appliquer la mise à jour
  const applyUpdate = useCallback(async () => {
    if (!registration?.waiting) {
      console.warn('⚠️ Aucune mise à jour en attente');
      return;
    }

    try {
      console.log('🔄 Application de la mise à jour...');
      
      // Envoyer un message au Service Worker pour qu'il prenne le contrôle
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // Écouter le contrôle du nouveau Service Worker
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('✅ Nouvelle version du Service Worker active');
        setSwInfo(prev => ({ ...prev, isUpdateAvailable: false }));
        
        // Recharger la page pour utiliser la nouvelle version
        window.location.reload();
      });
    } catch (error) {
      console.error('❌ Erreur lors de l\'application de la mise à jour:', error);
    }
  }, [registration]);

  // Fonction pour obtenir les informations du cache
  const getCacheInfo = useCallback(async () => {
    if (!registration?.active) {
      return {};
    }

    try {
      const messageChannel = new MessageChannel();
      
      return new Promise((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data);
        };
        
        registration.active?.postMessage(
          { type: 'GET_CACHE_INFO' },
          [messageChannel.port2]
        );
      });
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des infos cache:', error);
      return {};
    }
  }, [registration]);

  // Fonction pour vider le cache
  const clearCache = useCallback(async () => {
    if (!registration?.active) {
      console.warn('⚠️ Aucun Service Worker actif');
      return false;
    }

    try {
      console.log('🗑️ Vidage du cache...');
      
      const messageChannel = new MessageChannel();
      
      return new Promise((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          console.log('✅ Cache vidé avec succès');
          resolve(event.data.success);
        };
        
        registration.active?.postMessage(
          { type: 'CLEAR_CACHE' },
          [messageChannel.port2]
        );
      });
    } catch (error) {
      console.error('❌ Erreur lors du vidage du cache:', error);
      return false;
    }
  }, [registration]);

  // Fonction pour vérifier la connectivité
  const checkConnectivity = useCallback(() => {
    setSwInfo(prev => ({ ...prev, isOnline: navigator.onLine }));
  }, []);

  // Enregistrer le Service Worker au montage
  useEffect(() => {
    registerServiceWorker();
  }, [registerServiceWorker]);

  // Écouter les changements de connectivité
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Connexion rétablie');
      checkConnectivity();
    };

    const handleOffline = () => {
      console.log('📵 Connexion perdue');
      checkConnectivity();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkConnectivity]);

  // Mettre à jour les informations du cache périodiquement
  useEffect(() => {
    const updateCacheInfo = async () => {
      if (registration?.active) {
        const cacheInfo = await getCacheInfo();
        setSwInfo(prev => ({ ...prev, cacheInfo: cacheInfo as Record<string, number> }));
      }
    };

    // Mettre à jour immédiatement puis toutes les 30 secondes
    updateCacheInfo();
    const interval = setInterval(updateCacheInfo, 30000);

    return () => clearInterval(interval);
  }, [registration, getCacheInfo]);

  return {
    ...swInfo,
    registration,
    applyUpdate,
    getCacheInfo,
    clearCache,
    checkConnectivity
  };
};

export default useServiceWorker;