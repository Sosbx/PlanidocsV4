// Export des fonctions d'envoi d'emails via HTTP (méthode actuelle)
export { sendReminderEmail, sendBulkReminderEmails } from './sendReminder';

// Export des fonctions d'envoi d'emails via Firebase Callable Functions (méthode recommandée)
export { sendReminderEmailCallable, sendBulkReminderEmailsCallable } from './sendReminderCallable';