/**
 * Export centralisé des repositories
 */

import { UserRepository } from '../implementations/UserRepository';
import { PlanningRepository } from '../implementations/PlanningRepository';
import { DirectExchangeRepository } from '../implementations/DirectExchangeRepository';
import { ShiftExchangeRepository } from '../implementations/ShiftExchangeRepository';
import { IUserRepository } from '../interfaces/IUserRepository';
import { IPlanningRepository } from '../interfaces/IPlanningRepository';
import { IDirectExchangeRepository } from '../interfaces/IDirectExchangeRepository';
import { IShiftExchangeRepository } from '../interfaces/IShiftExchangeRepository';

// Instances singleton des repositories
let userRepositoryInstance: IUserRepository | null = null;
let planningRepositoryInstance: IPlanningRepository | null = null;
let directExchangeRepositoryInstance: IDirectExchangeRepository | null = null;
let shiftExchangeRepositoryInstance: IShiftExchangeRepository | null = null;

/**
 * Obtenir l'instance du repository des utilisateurs
 * @param associationId ID de l'association (par défaut: 'RD')
 */
export function getUserRepository(associationId: string = 'RD'): IUserRepository {
  // Pour simplifier, on crée une nouvelle instance pour chaque association
  // Dans une vraie app, on pourrait maintenir un cache par association
  return new UserRepository(associationId);
}

/**
 * Obtenir l'instance du repository des plannings
 */
export function getPlanningRepository(): IPlanningRepository {
  if (!planningRepositoryInstance) {
    planningRepositoryInstance = new PlanningRepository();
  }
  return planningRepositoryInstance;
}

/**
 * Obtenir l'instance du repository des échanges directs
 * @param associationId ID de l'association (par défaut: 'RD')
 */
export function getDirectExchangeRepository(associationId: string = 'RD'): IDirectExchangeRepository {
  // Pour simplifier, on crée une nouvelle instance pour chaque association
  // Dans une vraie app, on pourrait maintenir un cache par association
  return new DirectExchangeRepository(associationId);
}

/**
 * Obtenir l'instance du repository de la bourse aux gardes
 * @param associationId ID de l'association (par défaut: 'RD')
 */
export function getShiftExchangeRepository(associationId: string = 'RD'): IShiftExchangeRepository {
  // Pour simplifier, on crée une nouvelle instance pour chaque association
  // Dans une vraie app, on pourrait maintenir un cache par association
  return new ShiftExchangeRepository(associationId);
}

/**
 * Réinitialiser tous les repositories (utile pour les tests)
 */
export function resetRepositories(): void {
  userRepositoryInstance = null;
  planningRepositoryInstance = null;
  directExchangeRepositoryInstance = null;
  shiftExchangeRepositoryInstance = null;
}

// Export des interfaces pour typage
export type { IUserRepository } from '../interfaces/IUserRepository';
export type { IPlanningRepository } from '../interfaces/IPlanningRepository';
export type { IDirectExchangeRepository } from '../interfaces/IDirectExchangeRepository';
export type { IShiftExchangeRepository } from '../interfaces/IShiftExchangeRepository';
export type { IRepository } from '../interfaces/IRepository';