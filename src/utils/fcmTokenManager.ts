import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { requestNotificationPermission } from '../lib/firebase/messaging';
import { saveDeviceToken, getDeviceTokensForUser } from '../lib/firebase/deviceTokens';

/**
 * Utilitaire pour gérer les tokens FCM
 * Disponible dans la console via window.fcmManager
 */
class FCMTokenManager {
  /**
   * Vérifie l'état des tokens pour un utilisateur
   */
  async checkUserTokens(userId: string) {
    console.log(`🔍 Vérification des tokens pour l'utilisateur ${userId}...`);
    
    try {
      const tokens = await getDeviceTokensForUser(userId);
      
      if (tokens.length === 0) {
        console.log('❌ Aucun token trouvé pour cet utilisateur');
        console.log('💡 L\'utilisateur doit activer les notifications');
        return [];
      }
      
      console.log(`✅ ${tokens.length} token(s) trouvé(s):`);
      tokens.forEach((token, index) => {
        console.log(`  ${index + 1}. ${token.platform?.browser || 'Navigateur'} sur ${token.platform?.os || 'OS inconnu'}`);
        console.log(`     Type: ${token.platform?.type || 'unknown'}`);
        console.log(`     Dernière activité: ${token.lastActive}`);
        console.log(`     Token: ${token.token.substring(0, 30)}...`);
      });
      
      return tokens;
    } catch (error) {
      console.error('❌ Erreur lors de la vérification:', error);
      return [];
    }
  }
  
  /**
   * Active les notifications pour l'utilisateur actuel
   */
  async activateForCurrentUser() {
    // Récupérer l'utilisateur actuel depuis le localStorage ou window
    const currentUser = (window as any).currentUser;
    
    if (!currentUser) {
      console.error('❌ Aucun utilisateur connecté');
      console.log('💡 Connectez-vous d\'abord');
      return false;
    }
    
    console.log(`🔔 Activation des notifications pour ${currentUser.firstName} ${currentUser.lastName}...`);
    
    try {
      // Demander la permission et obtenir le token
      const token = await requestNotificationPermission();
      
      if (!token) {
        console.error('❌ Permission refusée ou erreur');
        console.log('💡 Vérifiez les paramètres du navigateur');
        return false;
      }
      
      console.log(`✅ Token obtenu: ${token.substring(0, 30)}...`);
      
      // Enregistrer le token
      await saveDeviceToken(
        currentUser.id, 
        token, 
        currentUser.associationId || 'RD'
      );
      
      console.log('✅ Token enregistré dans Firestore');
      
      // Test immédiat
      new Notification('Test Planidocs', {
        body: 'Les notifications sont maintenant activées !',
        icon: '/favicon.ico'
      });
      
      return true;
    } catch (error) {
      console.error('❌ Erreur lors de l\'activation:', error);
      return false;
    }
  }
  
  /**
   * Active les notifications pour un utilisateur spécifique (mode test)
   */
  async activateForUser(userId: string, associationId: string = 'RD') {
    console.log(`🔔 Activation forcée des notifications pour l'utilisateur ${userId}...`);
    
    try {
      // Demander la permission
      const token = await requestNotificationPermission();
      
      if (!token) {
        console.error('❌ Impossible d\'obtenir un token FCM');
        return false;
      }
      
      console.log(`✅ Token obtenu: ${token.substring(0, 30)}...`);
      
      // Enregistrer pour l'utilisateur spécifié
      await saveDeviceToken(userId, token, associationId);
      
      console.log('✅ Token enregistré pour l\'utilisateur', userId);
      
      // Vérifier
      await this.checkUserTokens(userId);
      
      return true;
    } catch (error) {
      console.error('❌ Erreur:', error);
      return false;
    }
  }
  
  /**
   * Nettoie tous les tokens d'un utilisateur
   */
  async clearUserTokens(userId: string) {
    console.log(`🗑️ Suppression des tokens pour l'utilisateur ${userId}...`);
    
    try {
      const tokensRef = collection(db, 'device_tokens');
      const q = query(tokensRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('ℹ️ Aucun token à supprimer');
        return 0;
      }
      
      const deletePromises = snapshot.docs.map(docSnapshot => 
        deleteDoc(doc(db, 'device_tokens', docSnapshot.id))
      );
      
      await Promise.all(deletePromises);
      
      console.log(`✅ ${snapshot.size} token(s) supprimé(s)`);
      return snapshot.size;
    } catch (error) {
      console.error('❌ Erreur lors de la suppression:', error);
      return 0;
    }
  }
  
  /**
   * Vérifie tous les tokens dans la base
   */
  async checkAllTokens() {
    console.log('🔍 Vérification de tous les tokens FCM...');
    
    try {
      const tokensRef = collection(db, 'device_tokens');
      const snapshot = await getDocs(tokensRef);
      
      if (snapshot.empty) {
        console.log('❌ Aucun token dans la base');
        return;
      }
      
      const userTokens: { [key: string]: number } = {};
      
      snapshot.forEach(doc => {
        const data = doc.data();
        userTokens[data.userId] = (userTokens[data.userId] || 0) + 1;
      });
      
      console.log(`✅ Total: ${snapshot.size} token(s) pour ${Object.keys(userTokens).length} utilisateur(s)`);
      console.table(userTokens);
      
    } catch (error) {
      console.error('❌ Erreur:', error);
    }
  }
  
  /**
   * Instructions d'utilisation
   */
  help() {
    console.log(`
🔧 FCM Token Manager - Commandes disponibles :

fcmManager.checkUserTokens('USER_ID')
  → Vérifie les tokens d'un utilisateur

fcmManager.activateForCurrentUser()
  → Active les notifications pour l'utilisateur connecté

fcmManager.activateForUser('USER_ID', 'RD')
  → Active les notifications pour un utilisateur spécifique (test)

fcmManager.clearUserTokens('USER_ID')
  → Supprime tous les tokens d'un utilisateur

fcmManager.checkAllTokens()
  → Liste tous les tokens dans la base

fcmManager.help()
  → Affiche cette aide

Exemple pour l'utilisateur test :
fcmManager.activateForUser('ZfSJCJzR0QQVPpxWPvi7e7uQTbG2', 'RD')
    `);
  }
}

// Créer une instance globale
const fcmManager = new FCMTokenManager();

// Exposer globalement en développement
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).fcmManager = fcmManager;
  console.log('🔧 FCM Token Manager chargé - tapez fcmManager.help() pour l\'aide');
}

export default fcmManager;