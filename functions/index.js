/**
 * Service d'envoi d'emails et de notifications push pour Planidocs
 * 
 * Fonctions Cloud Firebase pour l'envoi d'emails et de notifications push de rappel 
 * aux utilisateurs qui n'ont pas encore validé leurs désiderata.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
// Configurer CORS pour permettre les requêtes depuis n'importe quelle origine
const cors = require('cors')({
  origin: '*', // Permettre toutes les origines
  methods: ['GET', 'POST', 'OPTIONS'], // Méthodes autorisées
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'], // En-têtes autorisés
  credentials: true // Permettre l'envoi de cookies
});

// Région de déploiement
const region = 'europe-west1';

/**
 * Formater une date en fuseau horaire Europe/Paris
 * @param {Date} date - La date à formater
 * @returns {string} - La date formatée en dd/mm/yyyy
 */
const formatParisDate = (date) => {
  // Utiliser l'API Intl.DateTimeFormat pour formater en Europe/Paris
  const formatter = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  return formatter.format(date);
};

// Initialisation de Firebase Admin (une seule fois)
admin.initializeApp();

// Configuration du transporteur d'emails avec Gmail en utilisant les variables d'environnement
// Pour accéder en local à ces configurations, utiliser:
// firebase functions:config:get > .runtimeconfig.json
// puis: firebase emulators:start --only functions

// Récupération des identifiants depuis les variables d'environnement
let emailUser, emailPass;

try {
  // Récupérer les variables d'environnement
  const gmailConfig = functions.config().gmail;
  
  if (!gmailConfig) {
    throw new Error('Configuration Gmail non trouvée dans les variables d\'environnement');
  }
  
  emailUser = gmailConfig.user;
  emailPass = gmailConfig.pass;
  
  if (!emailUser || !emailPass) {
    throw new Error('Identifiants Gmail manquants dans les variables d\'environnement');
  }
  
  console.log('Identifiants Gmail récupérés avec succès depuis les variables d\'environnement');
} catch (error) {
  // Fallback sur des valeurs par défaut en développement (ne pas utiliser en production)
  console.error('Erreur lors de la récupération des variables d\'environnement:', error.message);
  console.warn('ATTENTION: Utilisation des identifiants par défaut - NE PAS UTILISER EN PRODUCTION');
  
  // Ces valeurs ne sont utilisées qu'en cas d'échec des variables d'environnement
  emailUser = 'arkane.hilal@h24scm.com';
  emailPass = 'zluq vooy fdfd uncv'; // Uniquement pour le développement
}

// Configurer le service d'email
const emailConfig = {
  service: 'gmail',
  auth: {
    user: emailUser,
    pass: emailPass
  }
};

// Créer un transporteur réutilisable
const transporter = nodemailer.createTransport(emailConfig);

/**
 * Fonction utilitaire pour valider les paramètres de base d'une requête
 */
const validateRequest = async (req, requiredParams = ['userId', 'deadline', 'idToken']) => {
  // Vérifier la méthode HTTP
  if (req.method !== 'POST') {
    throw new Error('Méthode non autorisée');
  }

  // Vérifier les paramètres requis
  for (const param of requiredParams) {
    if (!req.body[param]) {
      throw new Error(`Paramètre manquant: ${param}`);
    }
  }

  // Vérifier l'authentification
  const idToken = req.body.idToken;
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Erreur d\'authentification:', error);
    throw new Error('Authentification invalide');
  }
};

/**
 * Fonction utilitaire pour récupérer les données d'un utilisateur
 */
const getUserData = async (userId, associationId) => {
  // Déterminer la collection en fonction de l'association
  const collectionName = associationId === 'RG' ? 'users_RG' : 'users';
  console.log(`Recherche de l'utilisateur dans la collection ${collectionName}`);
  
  // Récupérer les informations de l'utilisateur
  const userSnapshot = await admin.firestore().collection(collectionName).doc(userId).get();
  
  if (!userSnapshot.exists) {
    throw new Error(`Utilisateur non trouvé (ID: ${userId})`);
  }

  const userData = userSnapshot.data();
  
  // Vérifier que l'utilisateur a une adresse email
  if (!userData.email) {
    throw new Error(`L'utilisateur ${userId} n'a pas d'adresse email`);
  }

  return userData;
};

/**
 * Fonction pour formater l'email
 */
const formatEmail = (userData, deadline) => {
  // Formater la date limite
  const deadlineDate = new Date(deadline);
  const formattedDeadline = formatParisDate(deadlineDate);

  // Calculer le nombre de jours restants
  const remainingDays = Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  
  // Déterminer le message en fonction du temps restant
  let urgenceMessage = '';
  if (remainingDays <= 1) {
    urgenceMessage = '<p style="color: #e53e3e; font-weight: bold;">URGENT : La date limite est aujourd\'hui ou demain!</p>';
  } else if (remainingDays <= 3) {
    urgenceMessage = '<p style="color: #dd6b20; font-weight: bold;">IMPORTANT : Il reste moins de 3 jours!</p>';
  }
  
  return {
    from: 'Planidocs <arkane.hilal@h24scm.com>',
    to: userData.email,
    subject: `Rappel : Validation de vos désiderata ${remainingDays <= 3 ? '(URGENT)' : ''}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; background-color: #f8fafc;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="https://planidocs.com/Logo.png" alt="Planidocs" style="max-width: 150px;">
        </div>
        
        <div style="background-color: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
          <h2 style="color: #4a5568; text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 15px;">Rappel : Validation de vos désiderata</h2>
          
          ${urgenceMessage}
          
          <p style="color: #4a5568;">Bonjour ${userData.firstName} ${userData.lastName},</p>
          
          <p style="color: #4a5568;">Nous vous rappelons que vous n'avez pas encore validé vos désiderata pour le planning à venir.</p>
          
          <p style="color: #4a5568;">La date limite pour la validation est le <strong>${formattedDeadline}</strong>, soit dans <strong>${remainingDays} jour${remainingDays > 1 ? 's' : ''}</strong>.</p>
          
          <p style="color: #4a5568;">Merci de vous connecter à la plateforme Planidocs pour compléter et valider vos désiderata dès que possible.</p>
          
          <div style="margin: 30px auto; text-align: center;">
            <a href="https://planidocs.com" style="background-color: #4299e1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; border: none;">
              Accéder à Planidocs
            </a>
          </div>
        </div>
        
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 0.9em; color: #718096; text-align: center;">
          <p>Ceci est un message automatique, merci de ne pas y répondre.</p>
          <p>© ${new Date().getFullYear()} Planidocs - Tous droits réservés</p>
        </div>
      </div>
    `
  };
};

/**
 * Fonction pour envoyer un email
 */
const sendEmail = async (mailOptions) => {
  try {
    // Vérification de base de l'adresse email (désactivée expression régulière trop stricte)
    if (!mailOptions.to || mailOptions.to.trim() === '') {
      throw new Error(`Adresse email manquante`);
    }

    console.log('Tentative d\'envoi d\'email à:', mailOptions.to);
    
    // Tentative d'envoi d'email
    const info = await transporter.sendMail(mailOptions);
    
    console.log('Email envoyé avec succès:', { 
      messageId: info.messageId,
      to: mailOptions.to,
      response: info.response
    });
    
    return true;
  } catch (error) {
    console.error('Erreur détaillée lors de l\'envoi de l\'email:', { 
      error: error.toString(),
      stack: error.stack,
      errorName: error.name,
      errorCode: error.code,
      to: mailOptions.to
    });
    
    // Messages d'erreur plus spécifiques selon les types d'erreurs courants
    if (error.code === 'EAUTH') {
      throw new Error(`Erreur d'authentification SMTP. Vérifiez les identifiants du compte email.`);
    } else if (error.code === 'ESOCKET') {
      throw new Error(`Erreur de connexion au serveur SMTP. Vérifiez la configuration du service email.`);
    } else if (error.code === 'EENVELOPE') {
      throw new Error(`Adresse email refusée par le serveur: ${mailOptions.to}`);
    } else {
      throw new Error(`Erreur d'envoi: ${error.message}`);
    }
  }
};

/**
 * Fonction cloud pour envoyer un email de rappel à un utilisateur
 * avec notification push simultanée
 */
exports.sendReminderEmail = functions.region(region).https.onRequest(async (req, res) => {
  // Ajouter explicitement les en-têtes CORS pour OPTIONS (preflight) et toutes les méthodes
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.set('Access-Control-Max-Age', '3600');

  // Gérer les requêtes OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  return cors(req, res, async () => {
    try {
      // Valider la requête
      const decodedToken = await validateRequest(req);
      
      // Extraire les paramètres
      const { userId, deadline, associationId } = req.body;
      console.log('Envoi de rappel:', { userId, deadline, associationId, senderUid: decodedToken.uid });
      
      // Récupérer les données utilisateur
      const userData = await getUserData(userId, associationId);
      
      // Préparer et envoyer l'email
      const mailOptions = formatEmail(userData, deadline);
      await sendEmail(mailOptions);
      
      // Créer l'ID de transaction unique pour associer email et notification
      const transactionId = `manual_reminder_${Date.now()}_${userId}`;
      
      // 1. Enregistrer l'historique d'envoi dans Firestore
      await admin.firestore().collection('email_logs').add({
        type: 'individual',
        userId: userId,
        senderUid: decodedToken.uid,
        associationId: associationId,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        deadline: deadline,
        status: 'sent',
        transactionId: transactionId
      });
      
      // 2. Formater la date pour l'affichage
      const deadlineDate = new Date(deadline);
      const formattedDeadline = formatParisDate(deadlineDate);
      
      // 3. Créer une notification in-app uniquement
      const notifMessage = `N'oubliez pas de valider vos désiderata avant le ${formattedDeadline}. Votre participation est essentielle pour la création du planning.`;
      const notifResult = await createAndSendNotification(
        userId,
        'Rappel : Validation des désiderata',
        notifMessage,
        'desiderata_reminder',
        '/desiderata',
        associationId,
        transactionId
      );
      
      console.log(`Notification in-app créée pour l'utilisateur ${userId}`);
      
      // Répondre avec succès
      return res.status(200).json({ 
        success: true,
        message: `Email de rappel envoyé avec succès à ${userData.email}`,
        emailSent: true,
        notificationSent: true,
        pushSent: false,
        pushDetails: {
          success: 0,
          failure: 0,
          total: 0
        }
      });
    } catch (error) {
      console.error('Erreur dans sendReminderEmail:', error);
      
      // Enregistrer l'erreur dans Firestore (optionnel)
      try {
        await admin.firestore().collection('email_logs').add({
          type: 'individual',
          userId: req.body.userId || 'unknown',
          senderUid: req.body.idToken ? 'auth_error' : 'unknown',
          associationId: req.body.associationId || 'unknown',
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'error',
          error: error.message || 'Unknown error'
        });
      } catch (logError) {
        console.error('Erreur d\'enregistrement du log:', logError);
      }
      
      return res.status(error.code === 'auth/id-token-expired' ? 401 : 500).json({
        success: false,
        error: error.message || 'Une erreur est survenue lors de l\'envoi du rappel'
      });
    }
  });
});

/**
 * Fonction cloud pour envoyer des emails de rappel en masse
 * avec notifications push simultanées
 */
exports.sendBulkReminderEmails = functions.region(region).https.onRequest(async (req, res) => {
  // Ajouter explicitement les en-têtes CORS pour OPTIONS (preflight) et toutes les méthodes
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.set('Access-Control-Max-Age', '3600');

  // Gérer les requêtes OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  return cors(req, res, async () => {
    try {
      // Valider la requête (avec userIds au lieu de userId)
      const requiredParams = ['userIds', 'deadline', 'idToken'];
      const decodedToken = await validateRequest(req, requiredParams);
      
      // Extraire les paramètres
      const { userIds, deadline, associationId } = req.body;
      
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ 
          success: false,
          error: 'Le paramètre userIds doit être un tableau non vide'
        });
      }
      
      console.log(`Envoi de ${userIds.length} rappels en masse:`, { 
        userCount: userIds.length,
        deadline,
        associationId,
        senderUid: decodedToken.uid
      });
      
      // Résultats
      const results = {
        success: 0,
        failed: 0,
        errors: [],
        notifications: {
          success: 0,
          failed: 0
        }
      };
      
      // Créer un ID de transaction global pour le lot
      const bulkId = `bulk_reminder_${Date.now()}`;
      
      // Formater la date limite pour les notifications
      const deadlineDate = new Date(deadline);
      const formattedDeadline = formatParisDate(deadlineDate);
      
      // Traiter chaque utilisateur
      for (const userId of userIds) {
        try {
          // Récupérer les données utilisateur
          const userData = await getUserData(userId, associationId);
          
          // Préparer et envoyer l'email
          const mailOptions = formatEmail(userData, deadline);
          await sendEmail(mailOptions);
          
          results.success++;
          
          // Créer un ID de transaction unique pour cet utilisateur
          const transactionId = `${bulkId}_${userId}`;
          
          // 1. Log individuel pour chaque envoi réussi
          await admin.firestore().collection('email_logs').add({
            type: 'bulk',
            bulkId: bulkId,
            userId: userId,
            senderUid: decodedToken.uid,
            associationId: associationId,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            deadline: deadline,
            status: 'sent',
            transactionId: transactionId
          });
          
          // 2. Créer une notification dans Firestore pour l'utilisateur
          await admin.firestore().collection('notifications').add({
            userId: userId,
            title: 'Rappel : Validation des désiderata',
            message: `N'oubliez pas de valider vos désiderata avant le ${formattedDeadline}. Votre participation est essentielle pour la création du planning.`,
            type: 'desiderata_reminder',
            iconType: 'warning',
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            link: '/desiderata',
            actionText: 'Voir mes désiderata',
            transactionId: transactionId,
            bulkId: bulkId,
            associationId: associationId
          });
          
          // 3. Envoyer une notification push si l'utilisateur a des appareils enregistrés
          try {
            // Récupérer les tokens d'appareil de l'utilisateur
            const tokensSnapshot = await admin.firestore()
              .collection('device_tokens')
              .where('userId', '==', userId)
              .get();
            
            if (!tokensSnapshot.empty) {
              const tokens = tokensSnapshot.docs.map(doc => doc.data().token);
              
              // Envoyer la notification push
              const pushResult = await admin.messaging().sendMulticast({
                notification: {
                  title: 'Rappel : Validation des désiderata',
                  body: `N'oubliez pas de valider vos désiderata avant le ${formattedDeadline}.`
                },
                data: {
                  type: 'desiderata_reminder',
                  link: '/desiderata',
                  createdAt: new Date().toISOString(),
                  transactionId: transactionId,
                  bulkId: bulkId
                },
                tokens: tokens
              });
              
              results.notifications.success += pushResult.successCount;
              results.notifications.failed += pushResult.failureCount;
              
              // Nettoyer les tokens invalides
              if (pushResult.failureCount > 0) {
                const failedTokens = [];
                pushResult.responses.forEach((resp, idx) => {
                  if (!resp.success) {
                    failedTokens.push(tokens[idx]);
                  }
                });
                
                // Supprimer les tokens invalides
                const deletePromises = failedTokens.map(token => 
                  admin.firestore().collection('device_tokens')
                    .where('token', '==', token)
                    .get()
                    .then(snapshot => {
                      snapshot.forEach(doc => doc.ref.delete());
                    })
                );
                
                await Promise.all(deletePromises);
              }
            }
          } catch (notifError) {
            // Ne pas faire échouer le processus d'envoi si la notification push échoue
            console.error(`Erreur lors de l'envoi de la notification push à l'utilisateur ${userId}:`, notifError);
          }
        } catch (error) {
          results.failed++;
          results.errors.push({ userId, error: error.message });
          console.error(`Erreur pour l'utilisateur ${userId}:`, error);
          
          // Log individuel pour chaque erreur
          await admin.firestore().collection('email_logs').add({
            type: 'bulk',
            bulkId: bulkId,
            userId: userId,
            senderUid: decodedToken.uid,
            associationId: associationId,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'error',
            error: error.message || 'Unknown error'
          });
        }
      }
      
      console.log('Résultats de l\'envoi en masse:', results);
      
      // Déterminer le statut de la réponse
      const allSuccessful = results.failed === 0;
      const allFailed = results.success === 0;
      
      // Répondre en fonction des résultats
      if (allSuccessful) {
        return res.status(200).json({ 
          success: true,
          message: `${results.success} emails et notifications envoyés avec succès`,
          details: results
        });
      } else if (allFailed) {
        return res.status(500).json({ 
          success: false,
          error: 'Tous les envois ont échoué',
          details: results
        });
      } else {
        return res.status(207).json({ // 207 Multi-Status
          success: true,
          message: `${results.success} emails et notifications envoyés, ${results.failed} échecs`,
          details: results
        });
      }
    } catch (error) {
      console.error('Erreur dans sendBulkReminderEmails:', error);
      return res.status(error.code === 'auth/id-token-expired' ? 401 : 500).json({
        success: false,
        error: error.message || 'Une erreur est survenue lors de l\'envoi des rappels'
      });
    }
  });
});

/**
 * Fonction de planification qui s'exécute toutes les 48 heures pour envoyer
 * des emails de rappel aux utilisateurs qui n'ont pas validé leurs désiderata
 */
exports.scheduledReminderEmails = functions.region(region).pubsub
  .schedule('0 19 */2 * *')
  .timeZone('Europe/Paris')
  .onRun(async (context) => {
    try {
      console.log('Début de l\'envoi automatique des rappels (toutes les 48h)');
      
      // Récupérer toutes les associations
      const associationsSnapshot = await admin.firestore().collection('associations').get();
      const associations = associationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      for (const association of associations) {
        const associationId = association.id;
        
        try {
          console.log(`Traitement de l'association: ${associationId}`);
          
          // Récupérer la configuration du planning actuel
          const configSnapshot = await admin.firestore()
            .collection(associationId === 'RG' ? 'planning_config_RG' : 'planning_config')
            .doc('current')
            .get();
          
          if (!configSnapshot.exists) {
            console.log(`Pas de configuration de planning trouvée pour l'association ${associationId}`);
            continue;
          }
          
          const planningConfig = configSnapshot.data();
          const deadline = planningConfig.deadline.toDate();
          
          // Vérifier si la date limite est dans le futur
          if (deadline.getTime() < Date.now()) {
            console.log(`La date limite est déjà passée pour l'association ${associationId}`);
            continue;
          }
          
          // Récupérer tous les utilisateurs actifs
          const usersCollectionName = associationId === 'RG' ? 'users_RG' : 'users';
          const usersSnapshot = await admin.firestore()
            .collection(usersCollectionName)
            .where('status', '==', 'active')
            .get();
          
          console.log(`Nombre total d'utilisateurs actifs pour l'association ${associationId}: ${usersSnapshot.size}`);
          
          // Récupérer les désiderata validés
          const desiderataCollectionName = associationId === 'RG' ? 'desiderata_RG' : 'desiderata';
          const desiderataSnapshot = await admin.firestore()
            .collection(desiderataCollectionName)
            .where('validatedAt', '!=', null)
            .get();
          
          // Créer un ensemble des IDs des utilisateurs qui ont validé leurs désiderata
          const validatedUserIds = new Set();
          desiderataSnapshot.forEach(doc => {
            validatedUserIds.add(doc.id);
          });
          
          console.log(`${validatedUserIds.size} utilisateurs ont déjà validé leurs désiderata pour l'association ${associationId}`);
          
          // Filtrer les utilisateurs qui n'ont pas validé leurs désiderata
          const userDocs = usersSnapshot.docs.filter(doc => !validatedUserIds.has(doc.id));
          
          if (userDocs.length === 0) {
            console.log(`Tous les utilisateurs ont validé leurs désiderata pour l'association ${associationId}`);
            continue;
          }
          
          const userIds = userDocs.map(doc => doc.id);
          console.log(`${userIds.length} utilisateurs n'ont pas validé leurs désiderata pour l'association ${associationId}`);
          
          // Résultats
          const results = {
            success: 0,
            failed: 0,
            errors: []
          };
          
          // Identifiant unique pour ce groupe d'envoi
          const bulkId = `scheduled_${Date.now()}`;
          
          // Traiter chaque utilisateur
          for (const userId of userIds) {
            try {
              // Récupérer les données utilisateur
              const userDoc = userDocs.find(doc => doc.id === userId);
              if (!userDoc) {
                throw new Error(`Document utilisateur non trouvé pour l'ID: ${userId}`);
              }
              const userData = userDoc.data();
              
              console.log(`Traitement de l'utilisateur ${userId} (${userData.email || 'email manquant'})`);
              
              // Vérifier que l'utilisateur a une adresse email
              if (!userData.email) {
                throw new Error(`L'utilisateur ${userId} n'a pas d'adresse email`);
              }
              
              // Préparer et envoyer l'email
              const mailOptions = formatEmail(userData, deadline.toISOString());
              await sendEmail(mailOptions);
              
              results.success++;
              
              // Log individuel pour chaque envoi réussi
              await admin.firestore().collection('email_logs').add({
                type: 'scheduled',
                bulkId: bulkId,
                userId: userId,
                senderUid: 'system',
                associationId: associationId,
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                deadline: deadline.toISOString(),
                status: 'sent'
              });
            } catch (error) {
              results.failed++;
              results.errors.push({ userId, error: error.message });
              console.error(`Erreur pour l'utilisateur ${userId}:`, error);
              
              // Log individuel pour chaque erreur
              await admin.firestore().collection('email_logs').add({
                type: 'scheduled',
                bulkId: bulkId,
                userId: userId,
                senderUid: 'system',
                associationId: associationId,
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'error',
                error: error.message || 'Unknown error'
              });
            }
          }
          
          console.log(`Résultats de l'envoi programmé pour l'association ${associationId}:`, results);
        } catch (associationError) {
          console.error(`Erreur lors du traitement de l'association ${associationId}:`, associationError);
        }
      }
      
      console.log('Fin de l\'envoi automatique des rappels');
      return null;
    } catch (error) {
      console.error('Erreur générale dans scheduledReminderEmails:', error);
      return null;
    }
  });

// Fonction sendPushNotification supprimée - Plus de notifications push
// Les notifications push ont été désactivées
const sendPushNotificationDisabled = async (userId, title, body, data = {}) => {
  try {
    console.log(`\n🔍 Début sendPushNotification pour utilisateur: ${userId}`);
    console.log(`   Titre: ${title}`);
    console.log(`   Message: ${body}`);
    
    // Récupérer les tokens de l'utilisateur
    const tokensSnapshot = await admin.firestore()
      .collection('device_tokens')
      .where('userId', '==', userId)
      .get();
    
    console.log(`   Nombre de documents trouvés dans device_tokens: ${tokensSnapshot.size}`);
    
    if (tokensSnapshot.empty) {
      console.log(`⚠️  Aucun token FCM trouvé pour l'utilisateur ${userId}`);
      console.log(`   Vérifiez que l'utilisateur a bien activé les notifications`);
      return { 
        success: false, 
        reason: 'no_tokens',
        successCount: 0,
        failureCount: 0
      };
    }
    
    // Collecter les tokens et leurs métadonnées
    const tokenDocs = [];
    tokensSnapshot.forEach(doc => {
      const docData = doc.data();
      console.log(`   Document ${doc.id}:`);
      console.log(`     - Platform: ${docData.platform?.type || 'unknown'} (${docData.platform?.browser || 'unknown'})`);
      console.log(`     - LastActive: ${docData.lastActive || 'unknown'}`);
      console.log(`     - Token: ${docData.token ? docData.token.substring(0, 20) + '...' : 'MISSING'}`);
      
      if (docData.token) {
        tokenDocs.push({
          id: doc.id,
          token: docData.token,
          platform: docData.platform
        });
      } else {
        console.log(`   ❌ Token manquant dans le document ${doc.id}`);
      }
    });
    
    const tokens = tokenDocs.map(doc => doc.token);
    console.log(`📨 ${tokens.length} token(s) valide(s) trouvé(s) pour l'utilisateur ${userId}`);
    
    // Préparer le message FCM avec configuration complète
    const message = {
      notification: {
        title: title,
        body: body,
        icon: '/favicon.ico',
        badge: '/badge-icon.png'
      },
      data: {
        ...data,
        userId: userId,
        timestamp: new Date().toISOString()
      },
      tokens: tokens,
      // Configuration spécifique pour le web
      webpush: {
        fcmOptions: {
          link: data.link ? `https://planidocs.com${data.link}` : 'https://planidocs.com'
        },
        notification: {
          icon: '/favicon.ico',
          badge: '/badge-icon.png',
          requireInteraction: true,
          vibrate: [200, 100, 200],
          actions: [
            {
              action: 'open',
              title: 'Ouvrir'
            }
          ]
        }
      },
      // Configuration pour Android
      android: {
        priority: 'high',
        notification: {
          icon: 'ic_notification',
          color: '#4299e1',
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK'
        }
      },
      // Configuration pour iOS
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            contentAvailable: true
          }
        }
      }
    };
    
    // Envoyer via FCM
    console.log(`🚀 Envoi du message FCM à ${tokens.length} token(s)...`);
    const response = await admin.messaging().sendMulticast(message);
    
    console.log(`🎯 Résultat FCM pour ${userId}: ${response.successCount}/${tokens.length} envoyés avec succès`);
    if (response.successCount > 0) {
      console.log(`   ✅ Notifications push envoyées avec succès`);
    }
    
    // Gérer les échecs et nettoyer les tokens invalides
    if (response.failureCount > 0) {
      console.log(`   ⚠️ ${response.failureCount} échec(s) détecté(s)`);
      const tokensToDelete = [];
      const errorDetails = [];
      
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const errorInfo = {
            token: tokens[idx].substring(0, 20) + '...',
            error: resp.error.message,
            code: resp.error.code
          };
          errorDetails.push(errorInfo);
          console.log(`   ❌ Erreur pour token ${idx}: ${resp.error.code} - ${resp.error.message}`);
          
          // Marquer pour suppression si token invalide
          if (resp.error.code === 'messaging/invalid-registration-token' ||
              resp.error.code === 'messaging/registration-token-not-registered' ||
              resp.error.code === 'messaging/invalid-argument') {
            tokensToDelete.push(tokens[idx]);
            console.log(`   🗑️ Token marqué pour suppression`);
          }
        }
      });
      
      console.log(`📊 Résumé des erreurs FCM pour ${userId}:`);
      errorDetails.forEach(err => {
        console.log(`   - ${err.code}: ${err.error}`);
      });
      
      // Supprimer les tokens invalides de Firestore
      if (tokensToDelete.length > 0) {
        console.log(`Nettoyage de ${tokensToDelete.length} token(s) invalide(s)`);
        for (const token of tokensToDelete) {
          const querySnapshot = await admin.firestore()
            .collection('device_tokens')
            .where('userId', '==', userId)
            .where('token', '==', token)
            .get();
          
          const deletePromises = [];
          querySnapshot.forEach(doc => {
            deletePromises.push(doc.ref.delete());
          });
          await Promise.all(deletePromises);
        }
      }
    }
    
    // Enregistrer dans les logs
    await admin.firestore().collection('push_logs').add({
      userId: userId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      title: title,
      successCount: response.successCount,
      failureCount: response.failureCount,
      totalTokens: tokens.length,
      type: data.type || 'manual'
    });
    
    return {
      success: response.successCount > 0,
      successCount: response.successCount,
      failureCount: response.failureCount,
      totalTokens: tokens.length
    };
    
  } catch (error) {
    console.error(`Erreur sendPushNotification pour ${userId}:`, error);
    return { 
      success: false, 
      error: error.message,
      successCount: 0,
      failureCount: 0
    };
  }
};

// Fonction stub pour remplacer sendPushNotification
const sendPushNotification = async (userId, title, body, data = {}) => {
  // Plus de notifications push - retourner toujours faux
  console.log(`Notifications push désactivées pour ${userId}`);
  return {
    success: false,
    reason: 'push_disabled',
    successCount: 0,
    failureCount: 0,
    totalTokens: 0
  };
};

/**
 * Fonction utilitaire pour créer une notification in-app uniquement
 * 
 * Cette fonction crée une notification dans Firestore (plus de push)
 */
const createAndSendNotification = async (userId, title, message, type, link, associationId, transactionId = null, bulkId = null) => {
  try {
    // Créer une notification dans Firestore uniquement
    const notificationRef = await admin.firestore().collection('notifications').add({
      userId: userId,
      title: title,
      message: message,
      type: type || 'desiderata_reminder',
      iconType: 'warning',
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      link: link || '/desiderata',
      actionText: 'Voir mes désiderata',
      associationId: associationId,
      ...(transactionId && { transactionId }),
      ...(bulkId && { bulkId })
    });
    
    // Plus d'envoi push - retourner uniquement le succès de la création
    return {
      success: true,
      notificationId: notificationRef.id,
      pushSuccess: 0,
      pushFailure: 0,
      totalTokens: 0,
      message: "Notification in-app créée avec succès"
    };
  } catch (error) {
    console.error(`Erreur lors de la création de notification pour l'utilisateur ${userId}:`, error);
    throw error;
  }
};

// Export sendPushNotification supprimé - Les notifications push sont désactivées