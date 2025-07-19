import React, { useState } from 'react';
import { formatParisDate } from '@/utils/timezoneUtils';
import { CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Calendar, Trash2, Plus, Edit, RefreshCw, ArrowRight } from 'lucide-react';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import { format } from 'date-fns';
import { frLocale } from '../utils/dateLocale';
import { SyncDetailsModal } from './modals/SyncDetailsModal';

export const SyncResultsDetails: React.FC = () => {
  const { lastSyncResult, lastSync, isAuthenticated } = useGoogleCalendar();
  const [showDetails, setShowDetails] = useState(false);
  const [showModal, setShowModal] = useState(false);

  console.log('SyncResultsDetails - lastSyncResult:', lastSyncResult);

  if (!isAuthenticated || !lastSyncResult) {
    return null;
  }

  const hasChanges = lastSyncResult.created > 0 || lastSyncResult.updated > 0 || lastSyncResult.deleted > 0 || lastSyncResult.converted > 0 || lastSyncResult.migrated > 0;
  const hasErrors = lastSyncResult.errors.length > 0;

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Synchronisation Google Calendar
            {lastSync && (
              <span className="text-xs text-gray-500">
                - Dernière sync : {formatParisDate(lastSync, 'dd/MM à HH:mm', { locale: frLocale })}
              </span>
            )}
          </h3>
          
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-gray-500 hover:text-gray-700"
          >
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Résumé des modifications */}
        <div className="flex items-center gap-4 text-sm">
          {!hasChanges && !hasErrors ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-4 h-4" />
              <span>Calendrier à jour</span>
            </div>
          ) : (
            <>
              {lastSyncResult.created > 0 && (
                <div className="flex items-center gap-1 text-green-600">
                  <Plus className="w-4 h-4" />
                  <span>{lastSyncResult.created} ajoutée{lastSyncResult.created > 1 ? 's' : ''}</span>
                </div>
              )}
              
              {lastSyncResult.deleted > 0 && (
                <div className="flex items-center gap-1 text-red-600">
                  <Trash2 className="w-4 h-4" />
                  <span>{lastSyncResult.deleted} supprimée{lastSyncResult.deleted > 1 ? 's' : ''}</span>
                </div>
              )}
              
              {lastSyncResult.updated > 0 && (
                <div className="flex items-center gap-1 text-blue-600">
                  <Edit className="w-4 h-4" />
                  <span>{lastSyncResult.updated} modifiée{lastSyncResult.updated > 1 ? 's' : ''}</span>
                </div>
              )}
              
              {lastSyncResult.converted > 0 && (
                <div className="flex items-center gap-1 text-purple-600">
                  <RefreshCw className="w-4 h-4" />
                  <span>{lastSyncResult.converted} convertie{lastSyncResult.converted > 1 ? 's' : ''}</span>
                </div>
              )}
              
              {lastSyncResult.migrated > 0 && (
                <div className="flex items-center gap-1 text-indigo-600">
                  <ArrowRight className="w-4 h-4" />
                  <span>{lastSyncResult.migrated} migrée{lastSyncResult.migrated > 1 ? 's' : ''}</span>
                </div>
              )}
              
              {hasErrors && (
                <div className="flex items-center gap-1 text-orange-600">
                  <AlertCircle className="w-4 h-4" />
                  <span>{lastSyncResult.errors.length} erreur{lastSyncResult.errors.length > 1 ? 's' : ''}</span>
                </div>
              )}
            </>
          )}
          
          {hasChanges && (
            <button
              onClick={() => setShowModal(true)}
              className="ml-auto text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Voir détails
            </button>
          )}
        </div>

        {/* Affichage des erreurs si expandé */}
        {showDetails && hasErrors && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <h4 className="text-sm font-medium text-red-700 mb-2">Erreurs rencontrées :</h4>
            <ul className="space-y-1">
              {lastSyncResult.errors.map((error, index) => (
                <li key={index} className="text-sm text-red-600">
                  • {error.date} : {error.error}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Modal des détails */}
      {showModal && (
        <SyncDetailsModal
          syncResult={lastSyncResult}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
};