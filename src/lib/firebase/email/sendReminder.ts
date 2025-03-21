import { httpsCallable } from 'firebase/functions';
import { functions } from '../config';

export const sendReminderEmail = async (userId: string, deadline: Date): Promise<{ success: boolean }> => {
  try {
    const sendEmail = httpsCallable(functions, 'sendReminderEmail');
    const result = await sendEmail({ 
      userId, 
      deadline: deadline.toISOString(),
      remainingDays: Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    });
    
    console.log('Reminder email response:', result.data);
    
    if (!result.data?.success) {
      throw new Error(result.data?.error || 'Échec de l\'envoi du rappel');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error sending reminder email:', {
      error,
      userId,
      deadline: deadline.toISOString(),
      errorCode: error?.code,
      errorMessage: error?.message
    });
    
    // Erreurs spécifiques
    if (error?.code === 'functions/unauthenticated') {
      throw new Error('Erreur d\'authentification avec Firebase');
    } else if (error?.code === 'functions/invalid-argument') {
      throw new Error('Données invalides pour l\'envoi du rappel');
    } else if (error?.code === 'functions/internal') {
      throw new Error('Erreur lors de l\'envoi de l\'email (vérifiez la configuration SMTP)');
    }
    
    throw new Error('Erreur lors de l\'envoi du rappel');
  }
};