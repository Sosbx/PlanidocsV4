import React, { useState, useEffect } from 'react';
import { formatParisDate } from '@/utils/timezoneUtils';
import { LogOut, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import type { ShiftAssignment } from '../types/planning';
import { format } from 'date-fns';
import { frLocale } from '../utils/dateLocale';

interface GoogleCalendarSyncProps {
  assignments: Record<string, ShiftAssignment>;
  disabled?: boolean;
}

export const GoogleCalendarSync: React.FC<GoogleCalendarSyncProps> = ({
  assignments,
  disabled = false,
}) => {
  const {
    isAuthenticated,
    isSyncing,
    lastSync,
    lastSyncResult,
    login,
    logout,
    smartSync,
  } = useGoogleCalendar();

  const [eventMode, setEventMode] = useState<'grouped' | 'separated'>(() => {
    // Charger la préférence depuis localStorage
    const saved = localStorage.getItem('planidocs_event_mode');
    return saved === 'separated' ? 'separated' : 'grouped';
  });

  // Sauvegarder la préférence quand elle change
  useEffect(() => {
    console.log('Mode changé:', eventMode);
    localStorage.setItem('planidocs_event_mode', eventMode);
  }, [eventMode]);

  const handleSync = async () => {
    if (!isAuthenticated) {
      login();
    } else {
      await smartSync(assignments, eventMode);
    }
  };

  // Compter le nombre de gardes
  const shiftCount = Object.values(assignments).filter(a => a && a.shiftType).length;

  return (
    <div className="google-calendar-sync">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Bouton principal */}
        <button
          onClick={handleSync}
          disabled={disabled || isSyncing || shiftCount === 0}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg font-medium
            transition-all duration-200
            ${isAuthenticated 
              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
              : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'
            }
            ${(disabled || shiftCount === 0) ? 'opacity-50 cursor-not-allowed' : ''}
            ${isSyncing ? 'cursor-wait' : ''}
          `}
        >
          {isSyncing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Synchronisation en cours...</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5" />
              <span>
                {isAuthenticated 
                  ? 'Synchroniser avec Google Calendar'
                  : 'Connecter Google Calendar'
                }
              </span>
            </>
          )}
        </button>

        {/* Sélecteur de mode d'affichage */}
        {isAuthenticated && (
          <div className="flex items-center gap-2 text-sm">
            <label className="text-gray-600">Mode :</label>
            <div className="flex gap-1">
              <button
                onClick={() => setEventMode('grouped')}
                className={`px-3 py-1 rounded-l-md border transition-colors ${
                  eventMode === 'grouped'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                disabled={isSyncing}
              >
                Groupé
              </button>
              <button
                onClick={() => setEventMode('separated')}
                className={`px-3 py-1 rounded-r-md border transition-colors ${
                  eventMode === 'separated'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                disabled={isSyncing}
              >
                Séparé
              </button>
            </div>
          </div>
        )}
      </div>

      {/* État de connexion et dernière sync */}
      {isAuthenticated && (
        <div className="mt-2 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle2 className="w-4 h-4" />
            <span>Connecté</span>
          </div>
          
          {lastSync && (
            <span className="text-gray-500">
              Dernière sync : {formatParisDate(lastSync, 'dd/MM à HH:mm', { locale: frLocale })}
            </span>
          )}

          <button
            onClick={logout}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            title="Se déconnecter de Google Calendar"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Résultat de la dernière synchronisation */}
      {lastSyncResult && isAuthenticated && (
        <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm">
          <div className="flex items-center gap-2">
            {lastSyncResult.errors.length === 0 ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-green-700">
                  {lastSyncResult.created === 0 && lastSyncResult.updated === 0 && lastSyncResult.deleted === 0 ? (
                    'Calendrier déjà à jour'
                  ) : (
                    <>
                      {lastSyncResult.created > 0 && `${lastSyncResult.created} ajoutée(s)`}
                      {lastSyncResult.created > 0 && (lastSyncResult.updated > 0 || ('duplicatesFound' in lastSyncResult && lastSyncResult.duplicatesFound > 0)) && ', '}
                      {lastSyncResult.updated > 0 && `${lastSyncResult.updated} mise(s) à jour`}
                      {lastSyncResult.updated > 0 && ('duplicatesFound' in lastSyncResult && lastSyncResult.duplicatesFound > 0) && ', '}
                      {'duplicatesFound' in lastSyncResult && lastSyncResult.duplicatesFound > 0 && `${lastSyncResult.duplicatesFound} doublon(s) adopté(s)`}
                      {(lastSyncResult.created > 0 || lastSyncResult.updated > 0 || ('duplicatesFound' in lastSyncResult && lastSyncResult.duplicatesFound > 0)) && lastSyncResult.deleted > 0 && ', '}
                      {lastSyncResult.deleted > 0 && `${lastSyncResult.deleted} supprimée(s)`}
                    </>
                  )}
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-orange-600" />
                <span className="text-orange-700">
                  {(lastSyncResult.created + lastSyncResult.updated)} réussie(s), {lastSyncResult.errors.length} erreur(s)
                </span>
              </>
            )}
          </div>
          
          {lastSyncResult.errors.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-orange-700 hover:underline">
                Voir les erreurs
              </summary>
              <ul className="mt-1 space-y-1">
                {lastSyncResult.errors.map((error, index) => (
                  <li key={index} className="text-red-600">
                    {error.date} : {error.error}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Message si aucune garde */}
      {shiftCount === 0 && (
        <p className="mt-2 text-sm text-gray-500">
          Aucune garde à synchroniser
        </p>
      )}
      
      {/* Informations sur la synchronisation */}
      {isAuthenticated && (
        <div className="mt-3 p-2 bg-blue-50 rounded-md text-xs text-blue-700">
          <strong>Synchronisation intelligente :</strong> Met à jour votre calendrier en ajoutant les nouvelles gardes, 
          modifiant celles qui ont changé et supprimant celles qui n'existent plus. 
          Les événements importés manuellement sont automatiquement détectés pour éviter les doublons.
          <br/><br/>
          <strong>Mode {eventMode === 'grouped' ? 'Groupé' : 'Séparé'} :</strong> {
            eventMode === 'grouped' 
              ? 'Une garde par jour regroupant toutes les périodes (ex: ML CA)'
              : 'Gardes séparées avec horaires précis (Matin: 7h-13h, Après-midi: 13h-18h, Soir: 18h-minuit)'
          }
        </div>
      )}
    </div>
  );
};