export const getAuthErrorMessage = (error: any): string => {
  if (!error.code) return 'Une erreur inattendue est survenue';

  switch (error.code) {
    case 'auth/email-already-in-use':
      return 'Cette adresse email est déjà utilisée';
    case 'auth/invalid-email':
      return 'Format d\'email invalide';
    case 'auth/weak-password':
      return 'Le mot de passe doit contenir au moins 6 caractères';
    case 'auth/invalid-credential':
      return 'Identifiants invalides';
    default:
      return 'Une erreur est survenue lors de l\'authentification';
  }
};