/**
 * Implémentation du repository des utilisateurs avec Firebase
 */

import { User } from '@/features/users/types';
import { IUserRepository } from '../interfaces/IUserRepository';
import { BaseRepository } from './BaseRepository';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { getCollectionName } from '@/utils/collectionUtils';
import { ensureUserRoles } from '@/features/users/utils/userUtils';
import { FirestoreCacheUtils } from '@/hooks/useFirestoreCache';

/**
 * Repository pour la gestion des utilisateurs
 */
export class UserRepository extends BaseRepository<User> implements IUserRepository {
  constructor(associationId: string = 'RD') {
    super('users', associationId);
  }

  /**
   * Récupérer un utilisateur par son login
   */
  async getByLogin(login: string, associationId: string): Promise<User | null> {
    try {
      const usersCollection = getCollectionName('users', associationId);
      const q = query(
        collection(db, usersCollection),
        where('login', '==', login.toUpperCase())
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const userData = this.documentToObject(doc.id, doc.data());
      
      // S'assurer que l'utilisateur appartient bien à l'association
      if (userData.associationId && userData.associationId !== associationId) {
        return null;
      }

      return ensureUserRoles(userData);
    } catch (error) {
      console.error(`Error getting user by login ${login}:`, error);
      return null;
    }
  }

  /**
   * Récupérer un utilisateur par son email
   */
  async getByEmail(email: string, associationId: string): Promise<User | null> {
    try {
      const usersCollection = getCollectionName('users', associationId);
      const q = query(
        collection(db, usersCollection),
        where('email', '==', email.toLowerCase())
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const userData = this.documentToObject(doc.id, doc.data());
      
      // S'assurer que l'utilisateur appartient bien à l'association
      if (userData.associationId && userData.associationId !== associationId) {
        return null;
      }

      return ensureUserRoles(userData);
    } catch (error) {
      console.error(`Error getting user by email ${email}:`, error);
      return null;
    }
  }

  /**
   * Récupérer tous les utilisateurs d'une association
   */
  async getByAssociation(associationId: string): Promise<User[]> {
    try {
      const usersCollection = getCollectionName('users', associationId);
      let q;

      // Pour Rive Droite, inclure les utilisateurs sans associationId
      if (associationId === 'RD') {
        const snapshot = await getDocs(collection(db, usersCollection));
        const users = snapshot.docs
          .map(doc => this.documentToObject(doc.id, doc.data()))
          .filter(user => !user.associationId || user.associationId === 'RD')
          .map(user => ensureUserRoles(user));
        
        return users;
      } else {
        // Pour les autres associations, filtrer par associationId
        q = query(
          collection(db, usersCollection),
          where('associationId', '==', associationId)
        );
        
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs
          .map(doc => this.documentToObject(doc.id, doc.data()))
          .map(user => ensureUserRoles(user));
      }
    } catch (error) {
      console.error(`Error getting users by association ${associationId}:`, error);
      return [];
    }
  }

  /**
   * Récupérer les utilisateurs par rôle
   */
  async getByRole(role: keyof User['roles'], associationId: string): Promise<User[]> {
    try {
      const users = await this.getByAssociation(associationId);
      return users.filter(user => user.roles && user.roles[role]);
    } catch (error) {
      console.error(`Error getting users by role ${role}:`, error);
      return [];
    }
  }

  /**
   * Récupérer les utilisateurs actifs
   */
  async getActiveUsers(associationId: string): Promise<User[]> {
    try {
      const users = await this.getByAssociation(associationId);
      return users.filter(user => user.status === 'active');
    } catch (error) {
      console.error(`Error getting active users:`, error);
      return [];
    }
  }

  /**
   * Vérifier si un login existe déjà
   */
  async loginExists(login: string, associationId: string): Promise<boolean> {
    const user = await this.getByLogin(login, associationId);
    return user !== null;
  }

  /**
   * Vérifier si un email existe déjà
   */
  async emailExists(email: string, associationId: string): Promise<boolean> {
    const user = await this.getByEmail(email, associationId);
    return user !== null;
  }

  /**
   * Mettre à jour les rôles d'un utilisateur
   */
  async updateRoles(userId: string, roles: User['roles']): Promise<void> {
    try {
      await this.update(userId, { roles });
      
      // Invalider le cache pour cet utilisateur
      FirestoreCacheUtils.invalidate(`user_${userId}`);
    } catch (error) {
      console.error(`Error updating roles for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Mettre à jour le statut d'un utilisateur
   */
  async updateStatus(userId: string, status: User['status']): Promise<void> {
    try {
      await this.update(userId, { status });
      
      // Invalider le cache pour cet utilisateur
      FirestoreCacheUtils.invalidate(`user_${userId}`);
    } catch (error) {
      console.error(`Error updating status for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Marquer un planning comme validé
   */
  async markPlanningAsValidated(userId: string): Promise<void> {
    try {
      await this.update(userId, { hasValidatedPlanning: true });
      
      // Invalider le cache pour cet utilisateur
      FirestoreCacheUtils.invalidate(`user_${userId}`);
    } catch (error) {
      console.error(`Error marking planning as validated for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * S'abonner aux changements des utilisateurs d'une association
   */
  subscribeToAssociationUsers(
    associationId: string,
    callback: (users: User[]) => void
  ): () => void {
    const options = associationId === 'RD' 
      ? undefined 
      : { where: [{ field: 'associationId', operator: '==' as const, value: associationId }] };

    return this.subscribeToCollection((users) => {
      // Pour RD, filtrer les utilisateurs sans associationId ou avec RD
      if (associationId === 'RD') {
        const filteredUsers = users
          .filter(user => !user.associationId || user.associationId === 'RD')
          .map(user => ensureUserRoles(user));
        callback(filteredUsers);
      } else {
        callback(users.map(user => ensureUserRoles(user)));
      }
    }, options);
  }

  /**
   * Créer un utilisateur avec les rôles par défaut
   */
  async create(data: Omit<User, 'id' | 'createdAt' | 'lastModified'>): Promise<User> {
    // S'assurer que les rôles sont définis
    const userData = {
      ...data,
      roles: data.roles || { isUser: true, isAdmin: false, isManager: false }
    };

    const user = await super.create(userData);
    return ensureUserRoles(user);
  }
}