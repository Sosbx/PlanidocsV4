/**
 * Interface pour le repository des utilisateurs
 */

import { User } from '@/features/users/types';
import { IRepository } from './IRepository';

/**
 * Interface spécifique pour le repository des utilisateurs
 */
export interface IUserRepository extends IRepository<User> {
  /**
   * Récupérer un utilisateur par son login
   */
  getByLogin(login: string, associationId: string): Promise<User | null>;

  /**
   * Récupérer un utilisateur par son email
   */
  getByEmail(email: string, associationId: string): Promise<User | null>;

  /**
   * Récupérer tous les utilisateurs d'une association
   */
  getByAssociation(associationId: string): Promise<User[]>;

  /**
   * Récupérer les utilisateurs par rôle
   */
  getByRole(role: keyof User['roles'], associationId: string): Promise<User[]>;

  /**
   * Récupérer les utilisateurs actifs
   */
  getActiveUsers(associationId: string): Promise<User[]>;

  /**
   * Vérifier si un login existe déjà
   */
  loginExists(login: string, associationId: string): Promise<boolean>;

  /**
   * Vérifier si un email existe déjà
   */
  emailExists(email: string, associationId: string): Promise<boolean>;

  /**
   * Mettre à jour les rôles d'un utilisateur
   */
  updateRoles(userId: string, roles: User['roles']): Promise<void>;

  /**
   * Mettre à jour le statut d'un utilisateur
   */
  updateStatus(userId: string, status: User['status']): Promise<void>;

  /**
   * Marquer un planning comme validé
   */
  markPlanningAsValidated(userId: string): Promise<void>;

  /**
   * S'abonner aux changements des utilisateurs d'une association
   */
  subscribeToAssociationUsers(
    associationId: string,
    callback: (users: User[]) => void
  ): () => void;
}