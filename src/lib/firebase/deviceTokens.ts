import { doc, setDoc, getDoc, deleteDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { createParisDate } from '@/utils/timezoneUtils';
import { db } from './config';
import { ASSOCIATIONS } from '../../constants/associations';

/**
 * Interface pour les tokens d'appareil
 */
export interface DeviceToken {
  userId: string;
  token: string;
  associationId: string;
  createdAt: string;
  platform: {
    type: string;
    os: string;
    browser: string;
    userAgent: string;
  };
  lastActive: string;
  docId?: string; // ID du document pour faciliter la gestion
}

/**
 * Enregistre un token d'appareil pour un utilisateur
 * @param userId ID de l'utilisateur
 * @param token Token FCM de l'appareil
 * @param associationId ID de l'association
 * @returns true si l'opération réussit
 */
export const saveDeviceToken = async (
  userId: string,
  token: string,
  associationId: string = ASSOCIATIONS.RIVE_DROITE
): Promise<boolean> => {
  try {
    // Vérifier si ce token existe déjà pour éviter les doublons
    const exists = await tokenExists(userId, token);
    if (exists) {
      console.log(`ℹ️ Token déjà enregistré pour ${userId}, mise à jour de lastActive`);
      // Mettre à jour lastActive pour le token existant
      await updateDeviceTokenLastActive(userId, token);
      return true;
    }
    
    // Créer un ID sûr sans caractères spéciaux
    // Format: userId_deviceType_browser_timestamp
    const timestamp = Date.now();
    const tokenHash = token.substring(0, 10).replace(/[^a-zA-Z0-9]/g, '');
    const platform = getPlatformInfo();
    const deviceType = platform.type || 'unknown';
    const browser = platform.browser || 'unknown';
    const docId = `${userId}_${deviceType}_${browser}_${tokenHash}_${timestamp}`;
    
    console.log(`📱 Enregistrement d'un nouveau token pour ${userId}`);
    console.log(`   ID du document: ${docId}`);
    
    const deviceTokenRef = doc(db, 'device_tokens', docId);
    
    await setDoc(deviceTokenRef, {
      userId,
      token,
      associationId,
      createdAt: createParisDate().toISOString(),
      platform,
      lastActive: createParisDate().toISOString(),
      docId // Stocker l'ID pour faciliter la suppression
    });
    
    console.log(`✅ Token FCM enregistré avec succès`);
    console.log(`   👤 Utilisateur: ${userId}`);
    console.log(`   📱 Appareil: ${deviceType} (${platform.os})`);
    console.log(`   🌐 Navigateur: ${browser}`);
    
    // Nettoyer les anciens tokens (garder max 5 par utilisateur)
    await cleanupOldTokens(userId);
    
    // Afficher le nombre total de tokens pour cet utilisateur
    const allTokens = await getDeviceTokensForUser(userId);
    console.log(`   📊 Total: ${allTokens.length} appareil(s) enregistré(s) pour cet utilisateur`);
    
    return true;
  } catch (error) {
    console.error("❌ Erreur lors de l'enregistrement du token FCM:", error);
    throw error;
  }
};

/**
 * Supprime un token d'appareil
 * @param userId ID de l'utilisateur
 * @param token Token FCM de l'appareil
 * @returns true si l'opération réussit
 */
export const removeDeviceToken = async (userId: string, token: string): Promise<boolean> => {
  try {
    // Rechercher le document avec ce token car l'ID a changé
    const tokensRef = collection(db, 'device_tokens');
    const q = query(
      tokensRef, 
      where('userId', '==', userId),
      where('token', '==', token)
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log(`Aucun token à supprimer pour l'utilisateur ${userId}`);
      return false;
    }
    
    // Supprimer tous les documents trouvés (normalement un seul)
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    console.log(`✅ ${snapshot.size} token(s) supprimé(s) pour l'utilisateur ${userId}`);
    return true;
  } catch (error) {
    console.error("❌ Erreur lors de la suppression du token:", error);
    throw error;
  }
};

/**
 * Met à jour la date de dernière activité d'un token d'appareil
 * @param userId ID de l'utilisateur
 * @param token Token FCM de l'appareil
 * @returns true si l'opération réussit
 */
export const updateDeviceTokenLastActive = async (userId: string, token: string): Promise<boolean> => {
  try {
    // Rechercher le document avec ce token
    const tokensRef = collection(db, 'device_tokens');
    const q = query(
      tokensRef,
      where('userId', '==', userId),
      where('token', '==', token)
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log(`Token non trouvé pour mise à jour: ${userId}`);
      return false;
    }
    
    // Mettre à jour le premier document trouvé (normalement un seul)
    const docRef = snapshot.docs[0].ref;
    await setDoc(docRef, {
      lastActive: createParisDate().toISOString()
    }, { merge: true });
    
    console.log(`✅ Dernière activité mise à jour pour le token de ${userId}`);
    return true;
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la date de dernière activité:", error);
    return false;
  }
};

/**
 * Récupère tous les tokens d'appareil d'un utilisateur
 * @param userId ID de l'utilisateur
 * @returns Liste des tokens d'appareil
 */
export const getDeviceTokensForUser = async (userId: string): Promise<DeviceToken[]> => {
  try {
    const tokensRef = collection(db, 'device_tokens');
    const q = query(tokensRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    
    const tokens: DeviceToken[] = [];
    snapshot.forEach(doc => {
      tokens.push(doc.data() as DeviceToken);
    });
    
    return tokens;
  } catch (error) {
    console.error("Erreur lors de la récupération des tokens d'appareil:", error);
    throw error;
  }
};

/**
 * Nettoie les anciens tokens inactifs d'un utilisateur
 * Garde seulement les 5 tokens les plus récents
 * @param userId ID de l'utilisateur
 */
export const cleanupOldTokens = async (userId: string): Promise<void> => {
  try {
    const tokens = await getDeviceTokensForUser(userId);
    
    // Si plus de 5 tokens, supprimer les plus anciens
    if (tokens.length > 5) {
      console.log(`🧹 Nettoyage des anciens tokens pour ${userId}: ${tokens.length} tokens trouvés`);
      
      // Trier par date de dernière activité
      const sortedTokens = tokens.sort((a, b) => 
        new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
      );
      
      // Garder seulement les 5 plus récents
      const tokensToDelete = sortedTokens.slice(5);
      
      for (const tokenData of tokensToDelete) {
        if (tokenData.docId) {
          const docRef = doc(db, 'device_tokens', tokenData.docId);
          await deleteDoc(docRef);
          console.log(`  🗑️ Suppression du token ancien: ${tokenData.platform?.browser} sur ${tokenData.platform?.os}`);
        }
      }
      
      console.log(`✅ ${tokensToDelete.length} ancien(s) token(s) supprimé(s)`);
    }
  } catch (error) {
    console.error('Erreur lors du nettoyage des tokens:', error);
  }
};

/**
 * Vérifie si un token existe déjà pour éviter les doublons
 * @param userId ID de l'utilisateur
 * @param token Token FCM
 * @returns true si le token existe déjà
 */
export const tokenExists = async (userId: string, token: string): Promise<boolean> => {
  try {
    const tokensRef = collection(db, 'device_tokens');
    const q = query(
      tokensRef,
      where('userId', '==', userId),
      where('token', '==', token)
    );
    
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error('Erreur lors de la vérification du token:', error);
    return false;
  }
};

/**
 * Obtient des informations sur la plateforme
 * @returns Informations sur la plateforme
 */
const getPlatformInfo = () => {
  if (typeof window === 'undefined') {
    return {
      type: 'unknown',
      os: 'unknown',
      browser: 'unknown',
      userAgent: 'unknown'
    };
  }
  
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  
  // Détection mobile
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
  
  // Détection du système d'exploitation
  let os = 'unknown';
  if (/android/i.test(userAgent)) {
    os = 'android';
  } else if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
    os = 'ios';
  } else if (/windows/i.test(userAgent)) {
    os = 'windows';
  } else if (/macintosh|mac os x/i.test(userAgent)) {
    os = 'macos';
  } else if (/linux/i.test(userAgent)) {
    os = 'linux';
  }
  
  return {
    type: isMobile ? 'mobile' : 'desktop',
    os,
    browser: getBrowser(),
    userAgent
  };
};

/**
 * Obtient des informations sur le navigateur
 * @returns Nom du navigateur
 */
const getBrowser = (): string => {
  if (typeof window === 'undefined') {
    return 'unknown';
  }
  
  const userAgent = navigator.userAgent;
  
  if (/chrome/i.test(userAgent) && !/edge/i.test(userAgent) && !/edg/i.test(userAgent)) return 'chrome';
  if (/firefox/i.test(userAgent)) return 'firefox';
  if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return 'safari';
  if (/edge/i.test(userAgent) || /edg/i.test(userAgent)) return 'edge';
  if (/opera|opr/i.test(userAgent)) return 'opera';
  
  return 'unknown';
};
