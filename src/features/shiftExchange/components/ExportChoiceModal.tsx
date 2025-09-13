import React from 'react';
import { X, FileDown, User, Users } from 'lucide-react';

interface ExportChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChoose: (choice: 'mine' | 'all') => void;
  myShiftsCount?: number;
  allShiftsCount?: number;
}

const ExportChoiceModal: React.FC<ExportChoiceModalProps> = ({
  isOpen,
  onClose,
  onChoose,
  myShiftsCount = 0,
  allShiftsCount = 0
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Options d'export</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-gray-600 mb-6">
          Choisissez les gardes à inclure dans l'export :
        </p>

        <div className="space-y-4">
          {/* Option : Mes gardes uniquement */}
          <button
            onClick={() => onChoose('mine')}
            className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg group-hover:bg-indigo-200 transition-colors">
                  <User className="h-6 w-6 text-indigo-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-gray-900">Mes gardes uniquement</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Exporter seulement les gardes où vous êtes impliqué
                  </p>
                </div>
              </div>
              {myShiftsCount > 0 && (
                <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                  {myShiftsCount} garde{myShiftsCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </button>

          {/* Option : Toutes les gardes */}
          <button
            onClick={() => onChoose('all')}
            className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-gray-900">Toutes les gardes</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Exporter l'ensemble des échanges de la période
                  </p>
                </div>
              </div>
              {allShiftsCount > 0 && (
                <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                  {allShiftsCount} garde{allShiftsCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </button>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportChoiceModal;