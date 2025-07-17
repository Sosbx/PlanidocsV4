import React from 'react';
import { X, Plus, Trash2, Edit, Calendar, AlertCircle, RefreshCw } from 'lucide-react';
import Portal from '../Portal';
import type { GoogleCalendarSyncResult } from '../../types/googleCalendar';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { parseParisDate, formatParisDate } from '../../utils/timezoneUtils';

interface SyncDetailsModalProps {
  syncResult: GoogleCalendarSyncResult;
  onClose: () => void;
}

export const SyncDetailsModal: React.FC<SyncDetailsModalProps> = ({ syncResult, onClose }) => {
  const formatDate = (dateStr: string) => {
    try {
      return formatParisDate(dateStr, 'dd/MM/yyyy', { locale: fr });
    } catch {
      return dateStr;
    }
  };

  const formatFullDate = (dateStr: string) => {
    try {
      return formatParisDate(dateStr, 'EEEE d MMMM yyyy', { locale: fr });
    } catch {
      return dateStr;
    }
  };

  const formatPeriod = (period?: 'M' | 'AM' | 'S') => {
    switch (period) {
      case 'M': return 'Matin';
      case 'AM': return 'Après-midi';
      case 'S': return 'Soir';
      default: return '';
    }
  };

  // Fusionner et trier tous les événements chronologiquement
  const getAllEventsSorted = () => {
    const allEvents: Array<{
      type: 'created' | 'deleted' | 'updated';
      date: string;
      event: any;
    }> = [];

    if (syncResult.createdEvents) {
      syncResult.createdEvents.forEach(event => {
        allEvents.push({ type: 'created', date: event.date, event });
      });
    }

    if (syncResult.deletedEvents) {
      syncResult.deletedEvents.forEach(event => {
        allEvents.push({ type: 'deleted', date: event.date, event });
      });
    }

    if (syncResult.updatedEvents) {
      syncResult.updatedEvents.forEach(event => {
        allEvents.push({ type: 'updated', date: event.date, event });
      });
    }

    // Trier par date
    return allEvents.sort((a, b) => {
      const dateA = parseParisDate(a.date).getTime();
      const dateB = parseParisDate(b.date).getTime();
      return dateA - dateB;
    });
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
        <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
          {/* En-tête */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Détails de la synchronisation
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Contenu avec colonnes */}
          <div className="overflow-auto max-h-[calc(90vh-8rem)]">
            {/* Vue en colonnes */}
            <div className="grid grid-cols-4 gap-4 p-6 min-w-[1200px]">
              {/* Colonne Ajoutées */}
              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-green-700 mb-4 sticky top-0 bg-green-50 pb-2">
                  <Plus className="w-5 h-5" />
                  Ajoutées ({syncResult.created || 0})
                </h3>
                <div className="space-y-2">
                  {syncResult.createdEvents && syncResult.createdEvents.length > 0 ? (
                    [...syncResult.createdEvents]
                      .sort((a, b) => parseParisDate(a.date).getTime() - parseParisDate(b.date).getTime())
                      .map((event, index) => (
                        <div key={index} className="bg-white p-3 rounded-lg shadow-sm border border-green-200">
                          <div className="font-medium text-gray-900">{formatDate(event.date)}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            {event.shiftType}
                            {event.period && ` - ${formatPeriod(event.period)}`}
                          </div>
                        </div>
                      ))
                  ) : (
                    <p className="text-gray-500 text-sm italic">Aucune garde ajoutée</p>
                  )}
                </div>
              </div>

              {/* Colonne Supprimées */}
              <div className="bg-red-50 rounded-lg p-4">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-red-700 mb-4 sticky top-0 bg-red-50 pb-2">
                  <Trash2 className="w-5 h-5" />
                  Supprimées ({syncResult.deleted || 0})
                </h3>
                <div className="space-y-2">
                  {syncResult.deletedEvents && syncResult.deletedEvents.length > 0 ? (
                    [...syncResult.deletedEvents]
                      .sort((a, b) => parseParisDate(a.date).getTime() - parseParisDate(b.date).getTime())
                      .map((event, index) => (
                        <div key={index} className="bg-white p-3 rounded-lg shadow-sm border border-red-200">
                          <div className="font-medium text-gray-900">{formatDate(event.date)}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            {event.shiftType}
                            {event.period && ` - ${formatPeriod(event.period)}`}
                          </div>
                        </div>
                      ))
                  ) : (
                    <p className="text-gray-500 text-sm italic">Aucune garde supprimée</p>
                  )}
                </div>
              </div>

              {/* Colonne Modifiées */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-blue-700 mb-4 sticky top-0 bg-blue-50 pb-2">
                  <Edit className="w-5 h-5" />
                  Modifiées ({syncResult.updated || 0})
                </h3>
                <div className="space-y-2">
                  {syncResult.updatedEvents && syncResult.updatedEvents.length > 0 ? (
                    [...syncResult.updatedEvents]
                      .sort((a, b) => parseParisDate(a.date).getTime() - parseParisDate(b.date).getTime())
                      .map((event, index) => (
                        <div key={index} className="bg-white p-3 rounded-lg shadow-sm border border-blue-200">
                          <div className="font-medium text-gray-900">{formatDate(event.date)}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            {event.previousShiftType && event.previousShiftType !== event.shiftType ? (
                              <>
                                <span className="line-through text-gray-500">{event.previousShiftType}</span>
                                {' → '}
                                <span className="font-medium">{event.shiftType}</span>
                              </>
                            ) : (
                              event.shiftType
                            )}
                            {event.period && ` - ${formatPeriod(event.period)}`}
                          </div>
                        </div>
                      ))
                  ) : (
                    <p className="text-gray-500 text-sm italic">Aucune garde modifiée</p>
                  )}
                </div>
              </div>

              {/* Colonne Converties */}
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-purple-700 mb-4 sticky top-0 bg-purple-50 pb-2">
                  <RefreshCw className="w-5 h-5" />
                  Converties ({syncResult.converted || 0})
                </h3>
                <div className="space-y-2">
                  {syncResult.convertedEvents && syncResult.convertedEvents.length > 0 ? (
                    [...syncResult.convertedEvents]
                      .sort((a, b) => parseParisDate(a.date).getTime() - parseParisDate(b.date).getTime())
                      .map((event, index) => (
                        <div key={index} className="bg-white p-3 rounded-lg shadow-sm border border-purple-200">
                          <div className="font-medium text-gray-900">{formatDate(event.date)}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            {event.shiftType}
                          </div>
                          <div className="text-xs text-purple-600 mt-1">
                            {event.fromMode === 'grouped' ? 'Groupé' : 'Séparé'} 
                            {' → '} 
                            {event.toMode === 'grouped' ? 'Groupé' : 'Séparé'}
                          </div>
                        </div>
                      ))
                  ) : (
                    <p className="text-gray-500 text-sm italic">Aucune garde convertie</p>
                  )}
                </div>
              </div>
            </div>

            {/* Section des erreurs en bas */}
            {syncResult.errors && syncResult.errors.length > 0 && (
              <div className="px-6 pb-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-orange-700 mb-3">
                  <AlertCircle className="w-5 h-5" />
                  Erreurs ({syncResult.errors.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {syncResult.errors.map((error, index) => (
                    <div key={index} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="font-medium text-orange-800">{error.date}</div>
                      <div className="text-sm text-orange-700">{error.error}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Pied de page */}
          <div className="px-6 py-4 border-t bg-gray-50">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};