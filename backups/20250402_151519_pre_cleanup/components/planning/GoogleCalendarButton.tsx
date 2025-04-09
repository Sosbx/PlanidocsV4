import React, { useState, useEffect } from 'react';
import { Calendar, LogIn, AlertCircle, Loader2 } from 'lucide-react';
import type { ShiftAssignment } from '../../types/planning';
import Toast from '../Toast';
import { AlertTriangle, Info, ExternalLink, LogOut } from 'lucide-react';

const GOOGLE_CLIENT_ID = '688748545967-bk80q2d9lvps5d3h0hn1d750plflm6s8.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar';
const CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const DEVELOPMENT_WARNING = `Cette fonctionnalité n'est pas disponible en environnement de développement.

Pour utiliser cette fonctionnalité :
1. Déployez l'application en production sur planidocs.com
2. Utilisez la version déployée pour synchroniser avec Google Calendar

Note : Cette restriction est une exigence de sécurité de Google.`;

interface GoogleCalendarButtonProps {
  assignments: Record<string, ShiftAssignment>;
  disabled?: boolean;
}

const GoogleCalendarButton: React.FC<GoogleCalendarButtonProps> = ({ assignments, disabled = false }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showDevWarning, setShowDevWarning] = useState(false);

  const isDevelopment = window.location.hostname.includes('webcontainer.io') || 
                       window.location.hostname.includes('localhost') ||
                       window.location.hostname.includes('local-credentialless') ||
                       !window.location.hostname.includes('planidocs.com');

  // Vérifier l'état de connexion au chargement
  React.useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        if (isDevelopment) {
          return;
        }
        await loadGoogleAPI();
        const auth = window.gapi.auth2.getAuthInstance();
        const user = auth.currentUser.get();
        setIsAuthenticated(user.isSignedIn());
        if (user.isSignedIn()) {
          setUserEmail(user.getBasicProfile().getEmail());
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
      }
    };

    checkAuthStatus();
  }, []);

  const loadGoogleAPI = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (isDevelopment) {
        reject(new Error('Google Calendar n\'est pas disponible en environnement de développement.'));
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        window.gapi.load('client:auth2', async () => {
          try {
            await window.gapi.client.init({
              clientId: GOOGLE_CLIENT_ID,
              scope: SCOPES,
            });
            await window.gapi.client.load('calendar', 'v3');
            resolve();
          } catch (error) {
            console.error('Error initializing Google API:', {
              error,
              origin: window.location.origin,
              hostname: window.location.hostname
            });
            reject(new Error('Erreur lors de l\'initialisation de l\'API Google. Vérifiez que vous utilisez la version en production.'));
          }
        });
      };
      script.onerror = () => {
        reject(new Error('Erreur lors du chargement de l\'API Google'));
      };
      document.body.appendChild(script);
    });
  };

  const handleSignIn = async () => {
    try {
      if (isDevelopment) {
        setShowDevWarning(true);
        return;
      }

      setIsLoading(true);
      await loadGoogleAPI();
      const auth = window.gapi.auth2.getAuthInstance();
      const user = await auth.signIn();
      setIsAuthenticated(true);
      setUserEmail(user.getBasicProfile().getEmail());
      setToast({
        visible: true,
        message: 'Connecté avec succès à Google Calendar',
        type: 'success'
      });
    } catch (error) {
      console.error('Error signing in:', error);
      if (!isDevelopment) {
        setToast({
          visible: true,
          message: error instanceof Error ? error.message : 'Erreur lors de la connexion à Google Calendar',
          type: 'error'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const auth = window.gapi.auth2.getAuthInstance();
      await auth.signOut();
      setIsAuthenticated(false);
      setUserEmail(null);
      setToast({
        visible: true,
        message: 'Déconnecté de Google Calendar',
        type: 'success'
      });
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };
  const createCalendarEvents = async () => {
    try {
      setIsSyncing(true);
      let deletedCount = 0;
      let addedCount = 0;
      let errorCount = 0;

      if (isDevelopment) {
        setShowDevWarning(true);
        return;
      }

      setToast({ visible: false, message: '', type: 'success' });

      if (!isAuthenticated) {
        await handleSignIn();
        if (!isAuthenticated) return;
      }

      // 1. Récupérer tous les événements existants
      const existingEvents = await window.gapi.client.calendar.events.list({
        calendarId: 'primary',
        q: 'planidocs-', // Rechercher uniquement nos événements
        showDeleted: false,
        singleEvents: true,
        maxResults: 2500
      });

      const existingPlanidocsEvents = existingEvents.result.items || [];
      const currentEventIds = new Set();

      // Créer les événements pour chaque garde
      for (const [key, assignment] of Object.entries(assignments)) {
        const [date, period] = key.split('-');
        const { timeSlot, shiftType } = assignment;
        const [startTime, endTime] = timeSlot.split(' - ');
        const eventId = `planidocs-${date}-${period}-${shiftType.replace(/\s+/g, '-')}`.toLowerCase();
        currentEventIds.add(eventId);

        // Créer les dates de début et de fin
        const startDate = new Date(`${date}T${startTime}:00`);
        let endDate = new Date(`${date}T${endTime}:00`);
        
        // Si l'heure de fin est avant l'heure de début, c'est que ça passe minuit
        if (endDate < startDate) {
          endDate.setDate(endDate.getDate() + 1);
        }

        // Créer l'événement
        const event = {
          summary: shiftType,
          description: `Garde: ${shiftType}\nPériode: ${period}`,
          start: {
            dateTime: startDate.toISOString(),
            timeZone: 'Europe/Paris',
          },
          end: {
            dateTime: endDate.toISOString(),
            timeZone: 'Europe/Paris',
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 24 * 60 }, // Rappel 24h avant
            ],
          },
          id: eventId,
        };

        try {
          await window.gapi.client.calendar.events.insert({
            calendarId: 'primary',
            resource: event,
          });
          addedCount++;
        } catch (error) {
          console.error('Error creating event:', error);
          errorCount++;
        }
      }

      // 2. Supprimer les événements qui n'existent plus dans le planning
      for (const event of existingPlanidocsEvents) {
        if (!currentEventIds.has(event.id)) {
          try {
            await window.gapi.client.calendar.events.delete({
              calendarId: 'primary',
              eventId: event.id
            });
            deletedCount++;
          } catch (error) {
            console.error('Error deleting event:', error);
            errorCount++;
          }
        }
      }

      // Message de confirmation avec les statistiques
      const totalEvents = Object.keys(assignments).length;
      setToast({ 
        visible: true, 
        message: `Synchronisation terminée : ${addedCount} gardes ajoutées, ${deletedCount} supprimées${
          errorCount > 0 ? `, ${errorCount} erreurs` : ''
        }`,
        type: errorCount === 0 ? 'success' : 'error'
      });

    } catch (error) {
      console.error('Error syncing with Google Calendar:', error);
      if (error instanceof Error && error.message.includes('popup')) {
        setToast({
          visible: true,
          message: 'La fenêtre de connexion Google a été bloquée. Veuillez autoriser les popups et réessayer.',
          type: 'error'
        });
      } else {
      setToast({ 
        visible: true, 
        message: error instanceof Error ? error.message : 'Erreur lors de la synchronisation avec Google Calendar',
        type: 'error'
      });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <Toast 
        message={toast.message}
        isVisible={toast.visible}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, visible: false }))}
      />
      
      {showDevWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-start mb-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">
                  Environnement de développement
                </h3>
                <p className="mt-2 text-sm text-gray-600 whitespace-pre-line">
                  {DEVELOPMENT_WARNING}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowDevWarning(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex items-center gap-2">
        {isAuthenticated ? (
          <>
            <div className="text-xs text-gray-600 hidden sm:block">
              {userEmail}
            </div>
            <button
              onClick={createCalendarEvents}
              disabled={disabled || isLoading}
              className="inline-flex items-center px-2 sm:px-4 py-2 border border-gray-300 text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Synchroniser avec Google Calendar"
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Calendar className="h-4 w-4 mr-2" />
              )}
              {isLoading ? (
                <>
                  <span className="hidden sm:inline">Synchronisation...</span>
                  <span className="sm:hidden">Sync...</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Synchroniser</span>
                  <span className="sm:hidden">Sync</span>
                </>
              )}
            </button>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center p-2 text-gray-500 hover:text-gray-700 focus:outline-none"
              title="Se déconnecter de Google Calendar"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            onClick={handleSignIn}
            disabled={disabled || isLoading}
            className="inline-flex items-center px-2 sm:px-4 py-2 border border-gray-300 text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Se connecter à Google Calendar"
          >
            <LogIn className="h-4 w-4 mr-2" />
            {isLoading ? (
              'Connexion...'
            ) : (
              <>
                <span className="hidden sm:inline">Se connecter à Google Calendar</span>
                <span className="sm:hidden">Google Calendar</span>
              </>
            )}
          </button>
        )}
      </div>
    </>
  );
};

export default GoogleCalendarButton;