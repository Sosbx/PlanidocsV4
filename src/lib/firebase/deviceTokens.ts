import { doc, setDoc, getDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
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
    const deviceTokenRef = doc(db, 'device_tokens', `${userId}_${token}`);
    
    await setDoc(deviceTokenRef, {
      userId,
      token,
      associationId,
      createdAt: new Date().toISOString(),
      platform: getPlatformInfo(),
      lastActive: new Date().toISOString()
    });
    
    console.log(`Token d'appareil enregistré pour l'utilisateur ${userId}`);
    return true;
  } catch (error) {
    console.error("Erreur lors de l'enregistrement du token d'appareil:", error);
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
    const deviceTokenRef = doc(db, 'device_tokens', `${userId}_${token}`);
    await deleteDoc(deviceTokenRef);
    
    console.log(`Token d'appareil supprimé pour l'utilisateur ${userId}`);
    return true;
  } catch (error) {
    console.error("Erreur lors de la suppression du token d'appareil:", error);
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
    const deviceTokenRef = doc(db, 'device_tokens', `${userId}_${token}`);
    
    await setDoc(deviceTokenRef, {
      lastActive: new Date().toISOString()
    }, { merge: true });
    
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
