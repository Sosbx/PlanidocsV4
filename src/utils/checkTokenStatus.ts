/**
 * Utilitaire pour vérifier l'état des tokens FCM
 * Usage: checkTokenStatus.check() dans la console du navigateur
 */

import { auth } from '@/lib/firebase/config';
import { getDeviceTokensForUser } from '@/lib/firebase/deviceTokens';
import { messaging } from '@/lib/firebase/messaging';
import { getToken } from 'firebase/messaging';

interface TokenStatus {
  userId: string | null;
  userEmail: string | null;
  localToken: string | null;
  currentFCMToken: string | null;
  firestoreTokens: any[];
  isMobile: boolean;
  notificationPermission: NotificationPermission;
  serviceWorkerStatus: string;
}

/**
 * Vérifie l'état complet des tokens FCM
 */
export const checkTokenStatus = async (): Promise<TokenStatus> => {
  const currentUser = auth.currentUser;
  const userId = currentUser?.uid || null;
  const userEmail = currentUser?.email || null;
  
  // Vérifier si c'est un mobile
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  // Récupérer le token local
  const localToken = userId ? localStorage.getItem(`fcm_token_${userId}`) : null;
  
  // Récupérer les tokens depuis Firestore
  let firestoreTokens: any[] = [];
  if (userId) {
    try {
      firestoreTokens = await getDeviceTokensForUser(userId);
    } catch (error) {
      console.error('Erreur lors de la récupération des tokens Firestore:', error);
    }
  }
  
  // Récupérer le token FCM actuel
  let currentFCMToken: string | null = null;
  if (messaging && isMobile && Notification.permission === 'granted') {
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      if (registration) {
        currentFCMToken = await getToken(messaging, {
          vapidKey: 'BI1B8WN6qnv-H2MRhSQSpQTaGCXQvLhZsLNaNmJ1p8jTdZPNMms8vVlLlw_N8pqF9RdnqKkCVwVzXzPfLqGnjPo',
          serviceWorkerRegistration: registration
        });
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du token FCM:', error);
    }
  }
  
  // Vérifier le statut du Service Worker
  let serviceWorkerStatus = 'non enregistré';
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (registration) {
      if (registration.active) {
        serviceWorkerStatus = 'actif';
      } else if (registration.waiting) {
        serviceWorkerStatus = 'en attente';
      } else if (registration.installing) {
        serviceWorkerStatus = 'installation';
      } else {
        serviceWorkerStatus = 'enregistré mais inactif';
      }
    }
  }
  
  const status: TokenStatus = {
    userId,
    userEmail,
    localToken,
    currentFCMToken,
    firestoreTokens,
    isMobile,
    notificationPermission: Notification.permission,
    serviceWorkerStatus
  };
  
  return status;
};

/**
 * Affiche un rapport détaillé dans la console
 */
export const displayTokenReport = async (): Promise<void> => {
  console.log('🔍 === DIAGNOSTIC DES TOKENS FCM ===');
  
  const status = await checkTokenStatus();
  
  // Informations utilisateur
  console.log('\n👤 UTILISATEUR:');
  console.log(`   ID: ${status.userId || '❌ Non connecté'}`);
  console.log(`   Email: ${status.userEmail || '❌ Non connecté'}`);
  
  // Environnement
  console.log('\n🌐 ENVIRONNEMENT:');
  console.log(`   Appareil: ${status.isMobile ? '📱 Mobile' : '💻 Desktop'}`);
  console.log(`   Permission: ${status.notificationPermission === 'granted' ? '✅ Accordée' : 
                                status.notificationPermission === 'denied' ? '❌ Refusée' : 
                                '⏸️ En attente'}`);
  console.log(`   Service Worker: ${status.serviceWorkerStatus}`);
  
  // Tokens
  console.log('\n🔑 TOKENS FCM:');
  console.log(`   Token local (localStorage): ${status.localToken ? '✅ Présent' : '❌ Absent'}`);
  if (status.localToken) {
    console.log(`      ${status.localToken.substring(0, 30)}...`);
  }
  
  console.log(`   Token FCM actuel: ${status.currentFCMToken ? '✅ Présent' : '❌ Absent'}`);
  if (status.currentFCMToken) {
    console.log(`      ${status.currentFCMToken.substring(0, 30)}...`);
  }
  
  // Vérifier la correspondance
  if (status.localToken && status.currentFCMToken) {
    if (status.localToken === status.currentFCMToken) {
      console.log('   ✅ Les tokens correspondent');
    } else {
      console.log('   ⚠️ Les tokens ne correspondent pas !');
    }
  }
  
  // Tokens Firestore
  console.log(`\n📊 TOKENS DANS FIRESTORE: ${status.firestoreTokens.length}`);
  if (status.firestoreTokens.length > 0) {
    status.firestoreTokens.forEach((tokenDoc, index) => {
      console.log(`   ${index + 1}. ${tokenDoc.platform?.type || 'unknown'} - ${tokenDoc.platform?.browser || 'unknown'}`);
      console.log(`      Token: ${tokenDoc.token ? tokenDoc.token.substring(0, 30) + '...' : 'MANQUANT'}`);
      console.log(`      Créé: ${tokenDoc.createdAt || 'unknown'}`);
      console.log(`      Dernière activité: ${tokenDoc.lastActive || 'unknown'}`);
      
      // Vérifier si ce token correspond au token actuel
      if (status.currentFCMToken && tokenDoc.token === status.currentFCMToken) {
        console.log('      ✅ TOKEN ACTUEL');
      }
    });
  } else {
    console.log('   ❌ Aucun token trouvé dans Firestore');
  }
  
  // Recommandations
  console.log('\n💡 RECOMMANDATIONS:');
  if (!status.userId) {
    console.log('   1. Connectez-vous à l\'application');
  }
  if (!status.isMobile) {
    console.log('   ⚠️ Les notifications sont désactivées sur desktop');
  }
  if (status.isMobile && status.notificationPermission !== 'granted') {
    console.log('   1. Activez les notifications dans les paramètres');
  }
  if (status.isMobile && !status.currentFCMToken) {
    console.log('   2. Rafraîchissez la page et acceptez les notifications');
  }
  if (status.isMobile && status.currentFCMToken && status.firestoreTokens.length === 0) {
    console.log('   3. Le token n\'est pas enregistré dans Firestore');
    console.log('      → Essayez de désactiver puis réactiver les notifications');
  }
  
  console.log('\n=================================');
};

// Exposer globalement pour utilisation dans la console
if (typeof window !== 'undefined') {
  (window as any).checkTokenStatus = {
    check: checkTokenStatus,
    report: displayTokenReport
  };
  
  console.log('🔧 Diagnostic des tokens FCM chargé');
  console.log('   Utilisez: checkTokenStatus.report() pour un rapport complet');
  console.log('   Utilisez: checkTokenStatus.check() pour obtenir les données brutes');
}

export default {
  check: checkTokenStatus,
  report: displayTokenReport
};