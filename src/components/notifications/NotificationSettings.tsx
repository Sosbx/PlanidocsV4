import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Smartphone, Monitor, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../features/auth/hooks';
import { requestNotificationPermission } from '../../lib/firebase/messaging';
import { saveDeviceToken, removeDeviceToken, getDeviceTokensForUser } from '../../lib/firebase/deviceTokens';
import type { DeviceToken } from '../../lib/firebase/deviceTokens';

/**
 * Composant de paramètres pour gérer les notifications push
 * Peut être intégré dans la page de profil ou les paramètres
 */
const NotificationSettings: React.FC = () => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [tokens, setTokens] = useState<DeviceToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  
  // Détection de l'environnement
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isPWA = window.matchMedia('(display-mode: standalone)').matches;
  const browser = getBrowserName();
  
  useEffect(() => {
    if (!user) return;
    
    // Vérifier le support et la permission
    if (!('Notification' in window)) {
      setPermission('unsupported');
    } else {
      setPermission(Notification.permission);
    }
    
    // Charger les tokens existants
    loadTokens();
  }, [user]);
  
  const loadTokens = async () => {
    if (!user) return;
    try {
      const userTokens = await getDeviceTokensForUser(user.id);
      setTokens(userTokens);
    } catch (error) {
      console.error('Erreur lors du chargement des tokens:', error);
    }
  };
  
  const handleActivate = async () => {
    if (!user) return;
    
    setLoading(true);
    setMessage(null);
    
    try {
      console.log('Demande d\'activation des notifications...');
      const token = await requestNotificationPermission();
      
      if (token) {
        await saveDeviceToken(user.id, token, user.associationId);
        setPermission('granted');
        await loadTokens();
        
        setMessage({
          type: 'success',
          text: '✅ Notifications activées avec succès !'
        });
        
        // Test immédiat
        new Notification('Test Planidocs', {
          body: 'Les notifications sont maintenant activées pour votre compte.',
          icon: '/favicon.ico',
          badge: '/badge-icon.png'
        });
      } else {
        const currentPermission = Notification.permission;
        setPermission(currentPermission);
        
        if (currentPermission === 'denied') {
          setMessage({
            type: 'error',
            text: '❌ Notifications refusées. Activez-les dans les paramètres du navigateur.'
          });
        } else {
          setMessage({
            type: 'error',
            text: '❌ Impossible d\'activer les notifications.'
          });
        }
      }
    } catch (error) {
      console.error('Erreur:', error);
      setMessage({
        type: 'error',
        text: '❌ Erreur lors de l\'activation des notifications.'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeactivate = async (tokenToRemove?: string) => {
    if (!user) return;
    
    setLoading(true);
    try {
      if (tokenToRemove) {
        await removeDeviceToken(user.id, tokenToRemove);
      } else {
        // Supprimer tous les tokens de cet appareil
        const currentToken = localStorage.getItem(`fcm_token_${user.id}`);
        if (currentToken) {
          await removeDeviceToken(user.id, currentToken);
          localStorage.removeItem(`fcm_token_${user.id}`);
          localStorage.removeItem('fcm_token');
        }
      }
      
      await loadTokens();
      setMessage({
        type: 'info',
        text: 'Notifications désactivées pour cet appareil.'
      });
    } catch (error) {
      console.error('Erreur:', error);
      setMessage({
        type: 'error',
        text: 'Erreur lors de la désactivation.'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const getInstructions = () => {
    if (permission === 'unsupported') {
      return {
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
        text: 'Votre navigateur ne supporte pas les notifications.',
        action: null
      };
    }
    
    if (permission === 'denied') {
      let instructions = '';
      
      if (isIOS) {
        instructions = isPWA 
          ? 'Allez dans Réglages → Notifications → Planidocs et activez les notifications.'
          : 'Sur iOS, installez d\'abord l\'app : Safari → Partager → Sur l\'écran d\'accueil.';
      } else if (isAndroid) {
        instructions = 'Allez dans Paramètres → Applications → ' + browser + ' → Notifications.';
      } else {
        instructions = 'Cliquez sur l\'icône à gauche de l\'URL et autorisez les notifications.';
      }
      
      return {
        icon: <BellOff className="h-5 w-5 text-red-500" />,
        text: instructions,
        action: null
      };
    }
    
    if (permission === 'granted' && tokens.length > 0) {
      return {
        icon: <CheckCircle className="h-5 w-5 text-green-500" />,
        text: `Notifications activées sur ${tokens.length} appareil(s).`,
        action: 'deactivate'
      };
    }
    
    return {
      icon: <Bell className="h-5 w-5 text-blue-500" />,
      text: 'Activez les notifications pour recevoir des rappels importants.',
      action: 'activate'
    };
  };
  
  const instructions = getInstructions();
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Notifications Push</h3>
        {instructions.icon}
      </div>
      
      <p className="text-sm text-gray-600 mb-4">{instructions.text}</p>
      
      {message && (
        <div className={`p-3 rounded-md mb-4 ${
          message.type === 'success' ? 'bg-green-50 text-green-800' :
          message.type === 'error' ? 'bg-red-50 text-red-800' :
          'bg-blue-50 text-blue-800'
        }`}>
          <p className="text-sm">{message.text}</p>
        </div>
      )}
      
      {instructions.action === 'activate' && (
        <button
          onClick={handleActivate}
          disabled={loading}
          className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Activation...' : 'Activer les notifications'}
        </button>
      )}
      
      {instructions.action === 'deactivate' && (
        <div className="space-y-3">
          <button
            onClick={() => handleDeactivate()}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Désactivation...' : 'Désactiver sur cet appareil'}
          </button>
          
          {tokens.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Appareils connectés :</h4>
              <div className="space-y-2">
                {tokens.map((token, index) => (
                  <div key={token.token} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center space-x-2">
                      {token.platform?.type === 'mobile' ? 
                        <Smartphone className="h-4 w-4 text-gray-500" /> : 
                        <Monitor className="h-4 w-4 text-gray-500" />
                      }
                      <span className="text-sm text-gray-600">
                        {token.platform?.browser || 'Navigateur'} - {token.platform?.os || 'OS inconnu'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeactivate(token.token)}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Supprimer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {isMobile && permission === 'default' && (
        <div className="mt-4 p-3 bg-yellow-50 rounded-md">
          <p className="text-xs text-yellow-800">
            <strong>Note mobile :</strong> Après avoir cliqué sur "Activer", 
            vous devrez accepter la demande de permission qui apparaîtra. 
            Si rien n'apparaît, vérifiez les paramètres de votre navigateur.
          </p>
        </div>
      )}
    </div>
  );
};

// Fonction utilitaire pour détecter le navigateur
function getBrowserName(): string {
  const userAgent = navigator.userAgent;
  
  if (/chrome/i.test(userAgent) && !/edge/i.test(userAgent) && !/edg/i.test(userAgent)) return 'Chrome';
  if (/firefox/i.test(userAgent)) return 'Firefox';
  if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return 'Safari';
  if (/edge/i.test(userAgent) || /edg/i.test(userAgent)) return 'Edge';
  if (/opera|opr/i.test(userAgent)) return 'Opera';
  
  return 'Navigateur';
}

export default NotificationSettings;