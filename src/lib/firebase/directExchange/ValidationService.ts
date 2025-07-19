import { OperationType } from '../../../types/exchange';
import { User } from '../../../types/users';

// Types d'opération valides
const VALID_OPERATION_TYPES: OperationType[] = ['exchange', 'give', 'replacement'];

// Combinaisons valides de types d'opération
const VALID_OPERATION_COMBINATIONS = [
  ['exchange'],
  ['give'],
  ['replacement'],
  ['exchange', 'give'],
  ['exchange', 'replacement'],
  ['give', 'replacement'],
  ['exchange', 'give', 'replacement']
];

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedTypes?: OperationType[];
}

/**
 * Service de validation pour les échanges directs
 * Assure la sécurité et la cohérence des données
 */
export class ValidationService {
  /**
   * Valide et nettoie les types d'opération
   */
  static validateOperationTypes(types: OperationType[]): ValidationResult {
    // Vérifier que c'est un tableau
    if (!Array.isArray(types)) {
      return {
        isValid: false,
        error: 'Les types d\'opération doivent être un tableau'
      };
    }

    // Vérifier qu'il y a au moins un type
    if (types.length === 0) {
      return {
        isValid: false,
        error: 'Au moins un type d\'opération est requis'
      };
    }

    // Filtrer les types invalides et les doublons
    const sanitizedTypes = [...new Set(
      types.filter(type => VALID_OPERATION_TYPES.includes(type))
    )] as OperationType[];

    // Vérifier qu'il reste des types valides
    if (sanitizedTypes.length === 0) {
      return {
        isValid: false,
        error: 'Aucun type d\'opération valide fourni'
      };
    }

    // Vérifier que la combinaison est valide
    const isValidCombination = VALID_OPERATION_COMBINATIONS.some(combo => 
      combo.length === sanitizedTypes.length &&
      combo.every(type => sanitizedTypes.includes(type))
    );

    if (!isValidCombination) {
      return {
        isValid: false,
        error: 'Combinaison de types d\'opération invalide'
      };
    }

    return {
      isValid: true,
      sanitizedTypes
    };
  }

  /**
   * Valide les permissions d'un utilisateur pour une opération
   */
  static validateUserPermissions(
    user: User | null,
    operationTypes: OperationType[]
  ): ValidationResult {
    if (!user) {
      return {
        isValid: false,
        error: 'Utilisateur non authentifié'
      };
    }

    // Vérifier les permissions pour le remplacement
    if (operationTypes.includes('replacement')) {
      // Seuls les médecins (non remplaçants) peuvent proposer des remplacements
      if (user.roles?.isReplacement === true) {
        return {
          isValid: false,
          error: 'Les remplaçants ne peuvent pas proposer de remplacements'
        };
      }
    }

    // Vérifier que l'utilisateur a un rôle valide
    if (!user.roles || (!user.roles.isDoctor && !user.roles.isReplacement)) {
      return {
        isValid: false,
        error: 'L\'utilisateur doit être médecin ou remplaçant'
      };
    }

    return { isValid: true };
  }

  /**
   * Valide une proposition d'échange
   */
  static validateProposal(
    proposalType: string,
    proposedShifts: any[],
    targetOperationTypes: OperationType[]
  ): ValidationResult {
    // Vérifier le type de proposition
    const validProposalTypes = ['take', 'exchange', 'both', 'replacement'];
    if (!validProposalTypes.includes(proposalType)) {
      return {
        isValid: false,
        error: 'Type de proposition invalide'
      };
    }

    // Vérifier la cohérence avec les types d'opération de la cible
    if (proposalType === 'exchange' && !targetOperationTypes.includes('exchange')) {
      return {
        isValid: false,
        error: 'Cette garde n\'est pas proposée à l\'échange'
      };
    }

    if (proposalType === 'take' && !targetOperationTypes.includes('give')) {
      return {
        isValid: false,
        error: 'Cette garde n\'est pas proposée en cession'
      };
    }

    // Pour un échange, vérifier qu'il y a des gardes proposées
    if (proposalType === 'exchange' && (!proposedShifts || proposedShifts.length === 0)) {
      return {
        isValid: false,
        error: 'Au moins une garde doit être proposée en échange'
      };
    }

    // Pour une cession, vérifier qu'il n'y a pas de gardes proposées
    if (proposalType === 'take' && proposedShifts && proposedShifts.length > 0) {
      return {
        isValid: false,
        error: 'Aucune garde ne doit être proposée pour une cession'
      };
    }

    return { isValid: true };
  }

  /**
   * Valide les dates et périodes
   */
  static validateShiftTiming(date: string, period: string): ValidationResult {
    // Vérifier le format de la date
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return {
        isValid: false,
        error: 'Format de date invalide (YYYY-MM-DD attendu)'
      };
    }

    // Vérifier la période
    const validPeriods = ['M', 'AM', 'S'];
    if (!validPeriods.includes(period)) {
      return {
        isValid: false,
        error: 'Période invalide (M, AM ou S attendu)'
      };
    }

    // Vérifier que la date n'est pas dans le passé
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const shiftDate = new Date(date);
    
    if (shiftDate < today) {
      return {
        isValid: false,
        error: 'Impossible de créer un échange pour une date passée'
      };
    }

    return { isValid: true };
  }

  /**
   * Valide un commentaire
   */
  static validateComment(comment: string): ValidationResult {
    // Limiter la longueur
    if (comment.length > 500) {
      return {
        isValid: false,
        error: 'Le commentaire ne doit pas dépasser 500 caractères'
      };
    }

    // Vérifier les caractères dangereux (XSS basique)
    const dangerousPatterns = [
      /<script/i,
      /<iframe/i,
      /javascript:/i,
      /on\w+\s*=/i
    ];

    if (dangerousPatterns.some(pattern => pattern.test(comment))) {
      return {
        isValid: false,
        error: 'Le commentaire contient des caractères non autorisés'
      };
    }

    return { isValid: true };
  }
}