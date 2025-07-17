import React, { createContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { createParisDate } from '@/utils/timezoneUtils';
import { useGoogleLogin } from '@react-oauth/google';
import { googleCalendarService } from '../../lib/google/googleCalendarService';
import { GOOGLE_CALENDAR_SCOPE } from '../../lib/google/googleCalendarConfig';
import type { ShiftAssignment } from '../../types/planning';
import type { GoogleCalendarSyncStatus, GoogleCalendarSyncResult } from '../../types/googleCalendar';
import { useToastContext } from '../toast';
import { useAuth } from '../../features/auth/hooks';
import { useAssociation } from '../association/AssociationContext';

interface GoogleCalendarContextType {
  // État
  isAuthenticated: boolean;
  isSyncing: boolean;
  lastSync: Date | null;
  lastSyncResult: GoogleCalendarSyncResult | null;
  
  // Actions
  login: () => void;
  logout: () => void;
  smartSync: (assignments: Record<string, ShiftAssignment>, eventMode?: 'grouped' | 'separated') => Promise<GoogleCalendarSyncResult | void>;
}

const GoogleCalendarContext = createContext<GoogleCalendarContextType | undefined>(undefined);

interface GoogleCalendarProviderProps {
  children: ReactNode;
}

export const GoogleCalendarProvider: React.FC<GoogleCalendarProviderProps> = ({ children }) => {
  const { showToast } = useToastContext();
  const { user } = useAuth();
  const { currentAssociation } = useAssociation();
  const [syncStatus, setSyncStatus] = useState<GoogleCalendarSyncStatus>({
    isAuthenticated: false,
    isSyncing: false,
    lastSync: null,
    lastSyncResult: null,
  });

  // Vérifier si on a un token stocké et valide
  useEffect(() => {
    const checkAndSetToken = async () => {
      const storedToken = localStorage.getItem('google_calendar_token');
      const tokenExpiry = localStorage.getItem('google_calendar_token_expiry');
      
      if (storedToken) {
        // Vérifier si le token n'est pas expiré
        if (tokenExpiry && Number(tokenExpiry) > Date.now()) {
          try {
            // Initialiser le service Google Calendar
            await googleCalendarService.init();
            googleCalendarService.setAccessToken(storedToken);
            setSyncStatus(prev => ({ ...prev, isAuthenticated: true }));
            console.log('Token restored from localStorage');
          } catch (error) {
            console.error('Error initializing Google Calendar:', error);
            logout();
          }
        } else {
          // Token expiré
          console.log('Token expired, clearing authentication');
          logout();
        }
      }
    };
    
    checkAndSetToken();
  }, []);

  // Déconnexion
  const logout = useCallback(() => {
    localStorage.removeItem('google_calendar_token');
    localStorage.removeItem('google_calendar_token_expiry');
    setSyncStatus({
      isAuthenticated: false,
      isSyncing: false,
      lastSync: null,
      lastSyncResult: null,
    });
    showToast('Déconnecté de Google Calendar', 'info');
  }, [showToast]);

  // Configuration de la connexion Google
  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      console.log('Token response:', tokenResponse);
      
      // Stocker le token et les informations supplémentaires
      localStorage.setItem('google_calendar_token', tokenResponse.access_token);
      localStorage.setItem('google_calendar_token_expiry', 
        String(Date.now() + (tokenResponse.expires_in * 1000))
      );
      
      // Initialiser le service avec le nouveau token
      googleCalendarService.setAccessToken(tokenResponse.access_token);
      
      setSyncStatus(prev => ({ ...prev, isAuthenticated: true }));
      showToast('Connexion à Google Calendar réussie', 'success');
    },
    onError: (error) => {
      console.error('Login Failed:', error);
      showToast('Erreur de connexion à Google Calendar', 'error');
    },
    scope: GOOGLE_CALENDAR_SCOPE,
    flow: 'implicit', // Utiliser le flow implicite pour obtenir directement le token
  });

  // Synchronisation intelligente avec détection de doublons
  const smartSync = useCallback(async (
    assignments: Record<string, ShiftAssignment>,
    eventMode: 'grouped' | 'separated' = 'grouped'
  ) => {
    if (!syncStatus.isAuthenticated || !user) {
      showToast('Veuillez vous connecter à Google Calendar', 'error');
      return;
    }

    setSyncStatus(prev => ({ ...prev, isSyncing: true }));
    showToast('Analyse et synchronisation...', 'info');

    try {
      // Toujours utiliser la détection de doublons
      const result = await googleCalendarService.smartSyncWithDuplicateDetection(
        user.id,
        assignments,
        currentAssociation,
        true,
        eventMode
      );
      
      console.log('Sync result in context:', result);
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSync: createParisDate(),
        lastSyncResult: result,
      }));

      // Message détaillé selon les résultats
      if (result.errors.length === 0) {
        const actions = [];
        if (result.created > 0) actions.push(`${result.created} ajoutée(s)`);
        if (result.updated > 0) actions.push(`${result.updated} mise(s) à jour`);
        if (result.deleted > 0) actions.push(`${result.deleted} supprimée(s)`);
        if (result.converted > 0) actions.push(`${result.converted} convertie(s)`);
        if ('duplicatesFound' in result && result.duplicatesFound > 0) {
          actions.push(`${result.duplicatesFound} doublon(s) adopté(s)`);
        }
        
        if (actions.length > 0) {
          showToast(
            `Synchronisation réussie : ${actions.join(', ')}`,
            'success'
          );
        } else {
          showToast('Calendrier déjà à jour', 'info');
        }
      } else {
        showToast(
          `Synchronisation partielle : ${result.errors.length} erreur(s)`,
          'warning'
        );
      }

      return result;
    } catch (error: any) {
      console.error('Smart sync error:', error);
      setSyncStatus(prev => ({ ...prev, isSyncing: false }));
      
      // Gérer l'expiration du token
      if (error.message === 'Not authenticated' || error.code === 401) {
        logout();
        showToast('Session expirée. Veuillez vous reconnecter.', 'error');
      } else {
        showToast('Erreur lors de la synchronisation', 'error');
      }
    }
  }, [syncStatus.isAuthenticated, user, currentAssociation, showToast, logout]);

  const value: GoogleCalendarContextType = {
    isAuthenticated: syncStatus.isAuthenticated,
    isSyncing: syncStatus.isSyncing,
    lastSync: syncStatus.lastSync,
    lastSyncResult: syncStatus.lastSyncResult,
    login,
    logout,
    smartSync,
  };

  return (
    <GoogleCalendarContext.Provider value={value}>
      {children}
    </GoogleCalendarContext.Provider>
  );
};

export const useGoogleCalendarContext = () => {
  const context = React.useContext(GoogleCalendarContext);
  if (context === undefined) {
    throw new Error('useGoogleCalendarContext must be used within a GoogleCalendarProvider');
  }
  return context;
};