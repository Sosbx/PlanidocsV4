import React, { useState } from 'react';
import { X, Calendar, Info, LogOut, ChevronDown } from 'lucide-react';
import Portal from '../Portal';

interface SyncModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mode: 'grouped' | 'separated') => void;
  onLogout: () => void;
  currentMode: 'grouped' | 'separated';
}

export const SyncModeModal: React.FC<SyncModeModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm,
  onLogout,
  currentMode 
}) => {
  const [selectedMode, setSelectedMode] = useState<'grouped' | 'separated'>(currentMode);
  const [showExplanations, setShowExplanations] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(selectedMode);
    onClose();
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Mode de synchronisation
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {/* Options de mode */}
            <div className="space-y-3">
              <label className="flex items-start p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="syncMode"
                  value="grouped"
                  checked={selectedMode === 'grouped'}
                  onChange={() => setSelectedMode('grouped')}
                  className="mt-1 mr-3"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Mode Groupé</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Une seule entrée par jour regroupant toutes les gardes
                  </div>
                </div>
              </label>

              <label className="flex items-start p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="syncMode"
                  value="separated"
                  checked={selectedMode === 'separated'}
                  onChange={() => setSelectedMode('separated')}
                  className="mt-1 mr-3"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Mode Séparé</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Gardes séparées avec horaires spécifiques
                  </div>
                </div>
              </label>
            </div>

            {/* Bouton pour afficher/masquer les explications */}
            <button
              type="button"
              onClick={() => setShowExplanations(!showExplanations)}
              className="w-full flex items-center justify-between p-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <span className="flex items-center gap-2">
                <Info className="w-4 h-4 text-gray-500" />
                {showExplanations ? 'Masquer les explications' : 'Voir les explications détaillées'}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showExplanations ? 'rotate-180' : ''}`} />
            </button>

            {/* Explications détaillées */}
            {showExplanations && (
              <div className="bg-blue-50 rounded-lg p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                <div className="text-sm text-gray-700">
                  <div className="space-y-3">
                    <div>
                      <span className="font-medium text-gray-900">Mode Groupé :</span>
                      <ul className="mt-1 ml-4 list-disc text-gray-600">
                        <li>Toutes les gardes du jour en un seul événement</li>
                        <li>Événement sur toute la journée (ex: "ML CA")</li>
                        <li>Idéal pour une vue d'ensemble rapide</li>
                      </ul>
                    </div>
                    
                    <div>
                      <span className="font-medium text-gray-900">Mode Séparé :</span>
                      <ul className="mt-1 ml-4 list-disc text-gray-600">
                        <li>Chaque garde avec son créneau horaire</li>
                        <li>ML : 7h00 - 12h59</li>
                        <li>CA : 13h00 - 17h59</li>
                        <li>Permet une planification plus précise</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center px-6 py-4 border-t bg-gray-50">
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Se déconnecter de Google Calendar"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Déconnexion</span>
            </button>
            
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Synchroniser
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
};