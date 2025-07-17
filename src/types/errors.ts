/**
 * Types pour la gestion des erreurs dans l'application
 */

/**
 * Interface de base pour toutes les erreurs de l'application
 */
export interface AppError extends Error {
  code?: string;
  details?: unknown;
  timestamp?: string;
}

/**
 * Erreurs spécifiques à Firebase
 */
export interface FirebaseError extends AppError {
  code: string;
  customData?: Record<string, unknown>;
}

/**
 * Erreurs d'authentification
 */
export interface AuthError extends FirebaseError {
  email?: string;
  credential?: unknown;
}

/**
 * Erreurs de validation
 */
export interface ValidationError extends AppError {
  field?: string;
  value?: unknown;
  constraints?: string[];
}

/**
 * Erreurs réseau
 */
export interface NetworkError extends AppError {
  status?: number;
  statusText?: string;
  url?: string;
}

/**
 * Type guard pour vérifier si une erreur est une FirebaseError
 */
export function isFirebaseError(error: unknown): error is FirebaseError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as any).code === 'string'
  );
}

/**
 * Type guard pour vérifier si une erreur est une AuthError
 */
export function isAuthError(error: unknown): error is AuthError {
  return isFirebaseError(error) && (error.code.startsWith('auth/') || 'email' in error);
}

/**
 * Type guard pour vérifier si une erreur est une ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'field' in error
  );
}

/**
 * Convertir une erreur inconnue en AppError
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof Error) {
    return error as AppError;
  }
  
  if (typeof error === 'string') {
    return new Error(error) as AppError;
  }
  
  if (error && typeof error === 'object' && 'message' in error) {
    const err = new Error(String((error as any).message)) as AppError;
    if ('code' in error) err.code = String((error as any).code);
    if ('details' in error) err.details = (error as any).details;
    return err;
  }
  
  return new Error('Une erreur inconnue s\'est produite') as AppError;
}

/**
 * Extraire un message d'erreur sûr pour l'affichage
 */
export function getErrorMessage(error: unknown): string {
  const appError = toAppError(error);
  return appError.message || 'Une erreur s\'est produite';
}

/**
 * Extraire le code d'erreur
 */
export function getErrorCode(error: unknown): string | undefined {
  if (isFirebaseError(error)) {
    return error.code;
  }
  const appError = toAppError(error);
  return appError.code;
}