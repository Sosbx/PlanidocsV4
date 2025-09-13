import React, { useState, useEffect } from 'react';
import { X, RotateCcw, Database, Calendar, User, AlertTriangle, Loader2 } from 'lucide-react';
import { listAvailableBackups, restoreFromBackup } from '../../../../lib/firebase/exchange';
import { formatParisDate } from '../../../../utils/timezoneUtils';
import { frLocale } from '../../../../utils/dateLocale';
import Toast from '../../../../components/common/Toast';

interface BackupHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreComplete?: () => void;
}

interface Backup {
  id: string;
  createdAt: Date;
  createdBy?: string;
  reason: string;
  metadata: {
    exchangeCount: number;
    shiftExchangeCount: number;
    planningsAffected: number;
    previousPhase: string;
  };
  restoredAt?: Date;
}

const BackupHistoryModal: React.FC<BackupHistoryModalProps> = ({
  isOpen,
  onClose,
  onRestoreComplete
}) => {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    if (isOpen) {
      loadBackups();
    }
  }, [isOpen]);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const backupList = await listAvailableBackups(20);
      setBackups(backupList as Backup[]);
    } catch (error) {
      console.error('Erreur lors du chargement des backups:', error);
      setToastMessage('Erreur lors du chargement des sauvegardes');
      setToastType('error');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (backupId: string) => {
    setSelectedBackup(backupId);
    setRestoring(true);
    setProgress(0);

    try {
      const result = await restoreFromBackup(backupId, (progress, message) => {
        setProgress(progress);
        setProgressMessage(message);
      });

      if (result.success) {
        setToastMessage('Restauration réussie ! Toutes les données ont été restaurées.');
        setToastType('success');
        onRestoreComplete?.();
      } else {
        setToastMessage(`Restauration partielle. Erreurs: ${result.errors.join(', ')}`);
        setToastType('error');
      }

      setShowToast(true);
      
      // Recharger la liste des backups
      await loadBackups();
      
      // Fermer après succès
      if (result.success) {
        setTimeout(() => onClose(), 2000);
      }
    } catch (error) {
      console.error('Erreur lors de la restauration:', error);
      setToastMessage('Erreur lors de la restauration');
      setToastType('error');
      setShowToast(true);
    } finally {
      setRestoring(false);
      setSelectedBackup(null);
      setProgress(0);
      setProgressMessage('');
    }
  };

  const getPhaseLabel = (phase: string) => {
    switch (phase) {
      case 'closed': return 'Fermée';
      case 'submission': return 'Position';
      case 'matching': return 'Appariement';
      case 'distribution': return 'Distribution';
      case 'completed': return 'Terminée';
      default: return phase;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
          {/* En-tête */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="h-6 w-6 text-indigo-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                Historique des sauvegardes
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
              disabled={restoring}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Contenu */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              </div>
            ) : backups.length === 0 ? (
              <div className="text-center py-12">
                <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Aucune sauvegarde disponible</p>
              </div>
            ) : (
              <div className="space-y-4">
                {backups.map((backup) => (
                  <div
                    key={backup.id}
                    className={`border rounded-lg p-4 ${
                      backup.restoredAt ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span className="font-medium text-gray-900">
                            {formatParisDate(backup.createdAt, 'PPPp', { locale: frLocale })}
                          </span>
                          {backup.restoredAt && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                              Utilisée
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                          <div>
                            <span className="font-medium">Échanges validés:</span> {backup.metadata.exchangeCount}
                          </div>
                          <div>
                            <span className="font-medium">Gardes en cours:</span> {backup.metadata.shiftExchangeCount}
                          </div>
                          <div>
                            <span className="font-medium">Utilisateurs:</span> {backup.metadata.planningsAffected}
                          </div>
                          <div>
                            <span className="font-medium">Phase:</span> {getPhaseLabel(backup.metadata.previousPhase)}
                          </div>
                        </div>

                        {backup.createdBy && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <User className="h-3 w-3" />
                            <span>Créée par l'utilisateur {backup.createdBy}</span>
                          </div>
                        )}

                        {backup.restoredAt && (
                          <div className="text-xs text-gray-500 mt-1">
                            Restaurée le {formatParisDate(backup.restoredAt, 'PPPp', { locale: frLocale })}
                          </div>
                        )}
                      </div>

                      <div className="ml-4">
                        {!backup.restoredAt && (
                          <button
                            onClick={() => handleRestore(backup.id)}
                            disabled={restoring}
                            className="inline-flex items-center px-3 py-2 border border-indigo-300 text-sm font-medium rounded-md text-indigo-700 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Restaurer
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Barre de progression pour le backup en cours de restauration */}
                    {restoring && selectedBackup === backup.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">
                            Restauration en cours...
                          </span>
                          <span className="text-sm text-gray-500">{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        {progressMessage && (
                          <p className="text-sm text-gray-600 mt-2">{progressMessage}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pied de page avec avertissement */}
          <div className="px-6 py-4 border-t border-gray-200 bg-yellow-50">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Important :</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>La restauration remplacera toutes les données actuelles</li>
                  <li>Les échanges effectués après la sauvegarde seront perdus</li>
                  <li>Cette action est irréversible</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Toast
        show={showToast}
        message={toastMessage}
        type={toastType}
        onClose={() => setShowToast(false)}
      />
    </>
  );
};

export default BackupHistoryModal;