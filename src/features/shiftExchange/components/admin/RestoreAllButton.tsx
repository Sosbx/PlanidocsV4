import React, { useState } from 'react';
import { AlertTriangle, RotateCcw, Loader2, CheckCircle, XCircle, Database } from 'lucide-react';
import { restoreAllBagExchanges, canRestoreAllExchanges } from '../../../../lib/firebase/exchange';
import { useAuth } from '../../../auth/hooks';
import Toast from '../../../../components/common/Toast';
import BackupHistoryModal from './BackupHistoryModal';

interface RestoreAllButtonProps {
  onRestoreComplete?: () => void;
  className?: string;
}

const RestoreAllButton: React.FC<RestoreAllButtonProps> = ({ 
  onRestoreComplete,
  className = '' 
}) => {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [showBackupHistory, setShowBackupHistory] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [canRestore, setCanRestore] = useState(true);
  const [exchangeCount, setExchangeCount] = useState(0);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [lastBackupId, setLastBackupId] = useState<string | null>(null);

  const checkCanRestore = async () => {
    const result = await canRestoreAllExchanges();
    setCanRestore(result.canRestore);
    setExchangeCount(result.exchangeCount);
    
    if (!result.canRestore && result.issues.length > 0) {
      setToastMessage(result.issues.join(', '));
      setToastType('error');
      setShowToast(true);
    }
  };

  const handleOpenModal = async () => {
    await checkCanRestore();
    setShowModal(true);
    setConfirmChecked(false);
  };

  const handleRestore = async () => {
    if (!confirmChecked || !canRestore) return;

    setIsRestoring(true);
    setProgress(0);
    setProgressMessage('Initialisation...');

    try {
      const report = await restoreAllBagExchanges((progress, message) => {
        setProgress(progress);
        setProgressMessage(message);
      }, user?.id);

      // Sauvegarder l'ID du backup
      if (report.backupId) {
        setLastBackupId(report.backupId);
      }

      // Afficher le résultat
      if (report.failedExchanges.length === 0) {
        setToastMessage(
          `Restauration terminée avec succès ! ${report.revertedExchanges} échanges annulés. ` +
          `Backup créé : ${report.backupId?.substring(0, 8)}...`
        );
        setToastType('success');
      } else {
        setToastMessage(
          `Restauration terminée avec ${report.failedExchanges.length} erreurs. ` +
          `${report.revertedExchanges}/${report.totalExchanges} échanges annulés.`
        );
        setToastType('error');
      }

      setShowToast(true);
      setShowModal(false);
      
      // Appeler le callback si fourni
      onRestoreComplete?.();
      
    } catch (error) {
      console.error('Erreur lors de la restauration:', error);
      setToastMessage('Erreur lors de la restauration. Veuillez réessayer.');
      setToastType('error');
      setShowToast(true);
    } finally {
      setIsRestoring(false);
      setProgress(0);
      setProgressMessage('');
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={handleOpenModal}
          className={`inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${className}`}
          title="Restaurer tous les échanges"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Restaurer tout
        </button>
        
        <button
          onClick={() => setShowBackupHistory(true)}
          className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          title="Historique des sauvegardes"
        >
          <Database className="h-4 w-4" />
        </button>
      </div>

      {/* Modal de confirmation */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            {!isRestoring ? (
              <>
                {/* En-tête avec icône d'avertissement */}
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="h-12 w-12 text-red-600" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      Restauration complète de la bourse aux gardes
                    </h3>
                    <p className="text-sm text-gray-500">
                      Action irréversible - Lisez attentivement
                    </p>
                  </div>
                </div>

                {/* Contenu */}
                <div className="mb-6">
                  <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                    <p className="text-sm text-red-800">
                      <strong>Cette action va :</strong>
                    </p>
                    <ul className="list-disc list-inside mt-2 text-sm text-red-700 space-y-1">
                      <li>Annuler <strong>{exchangeCount} échanges validés</strong></li>
                      <li>Restaurer toutes les gardes à leur état initial</li>
                      <li>Remettre la bourse en phase "Distribution"</li>
                      <li>Affecter tous les plannings des médecins concernés</li>
                    </ul>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
                    <p className="text-sm text-yellow-800">
                      <strong>⚠️ Attention :</strong> Les utilisateurs verront leurs plannings modifiés 
                      immédiatement. Il est recommandé de les informer avant cette opération.
                    </p>
                  </div>

                  {/* Checkbox de confirmation */}
                  <label className="flex items-start">
                    <input
                      type="checkbox"
                      checked={confirmChecked}
                      onChange={(e) => setConfirmChecked(e.target.checked)}
                      className="mt-1 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Je comprends les conséquences de cette action et je souhaite 
                      restaurer tous les échanges de la bourse aux gardes
                    </span>
                  </label>
                </div>

                {/* Boutons */}
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleRestore}
                    disabled={!confirmChecked || !canRestore}
                    className={`px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white ${
                      confirmChecked && canRestore
                        ? 'bg-red-600 hover:bg-red-700' 
                        : 'bg-gray-300 cursor-not-allowed'
                    }`}
                  >
                    Restaurer tous les échanges
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* État de progression */}
                <div className="text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Restauration en cours...
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Ne fermez pas cette fenêtre
                  </p>

                  {/* Barre de progression */}
                  <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                    <div 
                      className="bg-primary-600 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600">{progress}%</p>
                  
                  {/* Message de progression */}
                  {progressMessage && (
                    <p className="text-sm text-gray-500 mt-2">
                      {progressMessage}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Toast de notification */}
      <Toast
        show={showToast}
        message={toastMessage}
        type={toastType}
        onClose={() => setShowToast(false)}
      />

      {/* Modal d'historique des backups */}
      <BackupHistoryModal
        isOpen={showBackupHistory}
        onClose={() => setShowBackupHistory(false)}
        onRestoreComplete={() => {
          setShowBackupHistory(false);
          onRestoreComplete?.();
        }}
      />
    </>
  );
};

export default RestoreAllButton;