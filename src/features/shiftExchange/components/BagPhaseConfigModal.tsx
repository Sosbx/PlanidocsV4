import React, { useState } from 'react';
import { X, Save, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useBagPhase } from '../hooks/useBagPhase';
import type { BagPhaseConfig } from '../types';

interface BagPhaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal pour configurer les phases de la bourse aux gardes
 * Permet de changer la phase actuelle et la date limite d'envoi des gardes
 */
const BagPhaseConfigModal: React.FC<BagPhaseConfigModalProps> = ({ isOpen, onClose }) => {
  const { config, updateConfig } = useBagPhase();
  const [formData, setFormData] = useState<BagPhaseConfig>(config);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await updateConfig(formData);
      onClose();
    } catch (err) {
      setError('Erreur lors de la mise à jour de la configuration');
      console.error('Error updating bag phase config:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhaseChange = (phase: 'submission' | 'distribution' | 'completed') => {
    setFormData(prev => ({ ...prev, phase }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Configuration BaG</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phase actuelle
            </label>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handlePhaseChange('submission')}
                className={`w-full px-4 py-2 text-left rounded-lg border ${
                  formData.phase === 'submission'
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                Phase 1 : Envoi des gardes
              </button>
              <button
                type="button"
                onClick={() => handlePhaseChange('distribution')}
                className={`w-full px-4 py-2 text-left rounded-lg border ${
                  formData.phase === 'distribution'
                    ? 'bg-yellow-50 border-yellow-500 text-yellow-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                Phase 2 : Répartition
              </button>
              <button
                type="button"
                onClick={() => handlePhaseChange('completed')}
                className={`w-full px-4 py-2 text-left rounded-lg border ${
                  formData.phase === 'completed'
                    ? 'bg-green-50 border-green-500 text-green-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                Phase 3 : Terminé
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date limite d'envoi des gardes
            </label>
            <input
              type="datetime-local"
              value={format(formData.submissionDeadline, "yyyy-MM-dd'T'HH:mm")}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                submissionDeadline: new Date(e.target.value)
              }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
            >
              <Save className="h-4 w-4 inline-block mr-2" />
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BagPhaseConfigModal;
