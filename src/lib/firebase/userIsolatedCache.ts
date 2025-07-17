/**
 * userIsolatedCache.ts
 * 
 * Service de gestion du cache isolé par utilisateur et association
 * Empêche les fuites de données entre différents utilisateurs/associations
 */

import { auth } from './config';

interface UserCacheKey {
  userId: string;
  associationId: string;
}

class UserIsolatedCache {
  private static instance: UserIsolatedCache;
  private currentUserKey: UserCacheKey | null = null;
  
  private constructor() {
    // Écouter les changements d'authentification
    auth.onAuthStateChanged((user) => {
      if (!user) {
        // Si l'utilisateur se déconnecte, nettoyer tout
        this.clearAllUserData();
        this.currentUserKey = null;
      }
    });
  }
  
  public static getInstance(): UserIsolatedCache {
    if (!UserIsolatedCache.instance) {
      UserIsolatedCache.instance = new UserIsolatedCache();
    }
    return UserIsolatedCache.instance;
  }
  
  /**
   * Définit l'utilisateur et l'association actuels
   */
  public setCurrentUser(userId: string, associationId: string): void {
    const newKey = { userId, associationId };
    
    // Si on change d'utilisateur ou d'association, nettoyer les anciennes données
    if (this.currentUserKey && 
        (this.currentUserKey.userId !== userId || 
         this.currentUserKey.associationId !== associationId)) {
      this.clearCurrentUserData();
    }
    
    this.currentUserKey = newKey;
  }
  
  /**
   * Génère une clé de cache unique incluant l'utilisateur et l'association
   */
  public generateCacheKey(baseKey: string): string {
    if (!this.currentUserKey) {
      throw new Error('Aucun utilisateur défini pour le cache');
    }
    
    return `${this.currentUserKey.userId}_${this.currentUserKey.associationId}_${baseKey}`;
  }
  
  /**
   * Nettoie les données du cache pour l'utilisateur actuel
   */
  private clearCurrentUserData(): void {
    if (!this.currentUserKey) return;
    
    const prefix = `${this.currentUserKey.userId}_${this.currentUserKey.associationId}_`;
    
    // Nettoyer le localStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Nettoyer le sessionStorage
    const sessionKeysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(prefix)) {
        sessionKeysToRemove.push(key);
      }
    }
    sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
    
    console.log(`Cache nettoyé pour l'utilisateur ${this.currentUserKey.userId} (${this.currentUserKey.associationId})`);
  }
  
  /**
   * Nettoie toutes les données du cache (toutes les utilisateurs)
   */
  private clearAllUserData(): void {
    // Préserver certaines clés non sensibles
    const preserveKeys = ['theme', 'language', 'rememberedLogin'];
    
    // Nettoyer localStorage
    const localStorageKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !preserveKeys.includes(key)) {
        localStorageKeys.push(key);
      }
    }
    localStorageKeys.forEach(key => localStorage.removeItem(key));
    
    // Nettoyer sessionStorage complètement
    sessionStorage.clear();
    
    console.log('Tout le cache utilisateur a été nettoyé');
  }
  
  /**
   * Vérifie si l'utilisateur actuel correspond aux paramètres fournis
   */
  public isCurrentUser(userId: string, associationId: string): boolean {
    return this.currentUserKey !== null &&
           this.currentUserKey.userId === userId &&
           this.currentUserKey.associationId === associationId;
  }
  
  /**
   * Récupère les informations de l'utilisateur actuel
   */
  public getCurrentUserKey(): UserCacheKey | null {
    return this.currentUserKey;
  }
}

export const userIsolatedCache = UserIsolatedCache.getInstance();

// Fonctions utilitaires exportées
export const setCurrentCacheUser = (userId: string, associationId: string) => 
  userIsolatedCache.setCurrentUser(userId, associationId);

export const generateUserCacheKey = (baseKey: string) => 
  userIsolatedCache.generateCacheKey(baseKey);

export const isCurrentCacheUser = (userId: string, associationId: string) =>
  userIsolatedCache.isCurrentUser(userId, associationId);