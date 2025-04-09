import type { AuthError } from 'firebase/auth';

export const getAuthErrorMessage = (error: unknown): string => {
  if (!error) return 'Une erreur inattendue est survenue';

  const isFirebaseError = (err: any): err is AuthError => 
    err && typeof err === 'object' && 'code' in err;

  if (isFirebaseError(error)) {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'Cette adresse email est déjà utilisée';
      case 'auth/invalid-email':
        return 'Format d\'email invalide';
      case 'auth/weak-password':
        return 'Le mot de passe doit contenir au moins 6 caractères';
      case 'auth/invalid-credential':
        return 'Identifiants invalides';
      case 'auth/requires-recent-login':
        return 'Cette opération nécessite une authentification récente';
      default:
        return 'Une erreur est survenue lors de l\'authentification';
    }
  }
  
  return error instanceof Error ? error.message : 'Une erreur inattendue est survenue';
};