import React, { useState, useEffect } from 'react';
import { Bell, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../features/auth/hooks';
import { requestNotificationPermission } from '../../lib/firebase/messaging';
import { saveDeviceToken } from '../../lib/firebase/deviceTokens';

/**
 * Composant de bienvenue qui apparaît à la connexion
 * pour demander l'activation des notifications
 */
const WelcomeNotificationPrompt: React.FC = () => {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  useEffect(() => {
    if (!user) return;
    
    // Vérifier si c'est une nouvelle session
    const sessionKey = `session_${user.id}_${new Date().toDateString()}`;
    const promptShown = sessionStorage.getItem(sessionKey);
    
    // Vérifier si l'utilisateur a déjà un token
    const tokenKey = `fcm_token_${user.id}`;
    const hasToken = localStorage.getItem(tokenKey);
    
    // Montrer le prompt si:
    // 1. Nouvelle session du jour
    // 2. Pas de token enregistré
    // 3. Notifications pas refusées
    if (!promptShown && !hasToken && Notification.permission !== 'denied') {
      setTimeout(() => {
        setShow(true);
        sessionStorage.setItem(sessionKey, 'true');
      }, 2000); // Attendre 2 secondes après connexion
    }
  }, [user]);
  
  const handleActivate = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      console.log('🔔 Demande d\'activation des notifications...');
      const token = await requestNotificationPermission();
      
      if (token) {
        await saveDeviceToken(user.id, token, user.associationId);
        
        // Sauvegarder localement
        const tokenKey = `fcm_token_${user.id}`;
        localStorage.setItem(tokenKey, token);
        
        setStatus('success');
        
        // Message de succès
        new Notification('Bienvenue ' + user.firstName + ' ! 👋', {
          body: 'Les notifications sont maintenant activées. Vous ne manquerez aucune information importante.',
          icon: '/favicon.ico',
          badge: '/badge-icon.png'
        });
        
        // Fermer après succès
        setTimeout(() => setShow(false), 3000);
      } else {
        setStatus('error');
      }
    } catch (error) {
      console.error('Erreur:', error);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };
  
  if (!show || !user) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative animate-fadeIn">
        <button
          onClick={() => setShow(false)}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
        
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Bell className="h-8 w-8 text-blue-600" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Bienvenue {user.firstName} ! 👋
          </h2>
          
          <p className="text-gray-600">
            Pour ne manquer aucune information importante, activez les notifications.
          </p>
        </div>
        
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">
            Vous recevrez des alertes pour :
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start">
              <CheckCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
              <span>Rappels de validation des désiderata</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
              <span>Propositions d'échange de gardes</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
              <span>Confirmations et mises à jour importantes</span>
            </li>
          </ul>
        </div>
        
        {status === 'success' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <div className="flex items-center text-green-800">
              <CheckCircle className="h-5 w-5 mr-2" />
              <span className="font-medium">Notifications activées avec succès !</span>
            </div>
          </div>
        )}
        
        {status === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <div className="flex items-center text-red-800">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span className="text-sm">
                Les notifications ont été refusées. Vous pouvez les activer dans les paramètres du navigateur.
              </span>
            </div>
          </div>
        )}
        
        {status !== 'success' && (
          <div className="flex space-x-3">
            <button
              onClick={handleActivate}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                  Activation...
                </span>
              ) : (
                '✅ Activer les notifications'
              )}
            </button>
            
            <button
              onClick={() => setShow(false)}
              className="px-4 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
            >
              Plus tard
            </button>
          </div>
        )}
        
        {/* Information pour mobile */}
        {/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && (
          <p className="text-xs text-gray-500 text-center mt-4">
            💡 Sur mobile, assurez-vous d'accepter la demande de permission qui va apparaître.
          </p>
        )}
      </div>
    </div>
  );
};

export default WelcomeNotificationPrompt;