import React, { useState } from 'react';
import { X } from 'lucide-react';

interface ExportModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mode: 'grouped' | 'separated') => void;
  title: string;
}

export const ExportModeModal: React.FC<ExportModeModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title
}) => {
  const [selectedMode, setSelectedMode] = useState<'grouped' | 'separated'>('grouped');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(selectedMode);
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-4">
            {/* Option Groupé */}
            <label className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="exportMode"
                value="grouped"
                checked={selectedMode === 'grouped'}
                onChange={(e) => setSelectedMode(e.target.value as 'grouped')}
                className="mt-1 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">
                  Groupé <span className="text-sm text-gray-500">(recommandé)</span>
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Une garde par jour : ML CA
                </div>
              </div>
            </label>

            {/* Option Séparé */}
            <label className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="exportMode"
                value="separated"
                checked={selectedMode === 'separated'}
                onChange={(e) => setSelectedMode(e.target.value as 'separated')}
                className="mt-1 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">Séparé</div>
                <div className="text-sm text-gray-600 mt-1">
                  Horaires détaillés :<br />
                  ML : 7h-13h, CA : 13h-18h
                </div>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Exporter
            </button>
          </div>
        </div>
      </div>
    </>
  );
};