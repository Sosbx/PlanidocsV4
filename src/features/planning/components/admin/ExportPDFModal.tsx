import React, { useState, useEffect } from 'react';
import { createParisDate, subMonthsParis, formatParisDate } from '@/utils/timezoneUtils';
import { X, Calendar } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ExportPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportWithoutDesiderata: (startDate: Date, endDate: Date) => void;
  onExportWithDesiderata: (startDate: Date, endDate: Date) => void;
  userName?: string;
  isLoading?: boolean;
  defaultStartDate?: Date;
  defaultEndDate?: Date;
}

/**
 * Modal pour choisir le type d'export PDF
 * Permet de choisir entre export avec ou sans desiderata
 */
const ExportPDFModal: React.FC<ExportPDFModalProps> = ({
  isOpen,
  onClose,
  onExportWithoutDesiderata,
  onExportWithDesiderata,
  userName = '',
  isLoading = false,
  defaultStartDate,
  defaultEndDate
}) => {
  // Par défaut : les 4 derniers mois
  const [startDate, setStartDate] = useState<string>(
    formatParisDate(defaultStartDate || subMonthsParis(createParisDate(), 3), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState<string>(
    formatParisDate(defaultEndDate || createParisDate(), 'yyyy-MM-dd')
  );

  // Réinitialiser les dates quand le modal s'ouvre
  useEffect(() => {
    if (isOpen) {
      setStartDate(formatParisDate(defaultStartDate || subMonthsParis(createParisDate(), 3), 'yyyy-MM-dd'));
      setEndDate(formatParisDate(defaultEndDate || createParisDate(), 'yyyy-MM-dd'));
    }
  }, [isOpen, defaultStartDate, defaultEndDate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 relative">
        {/* Bouton fermer */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          disabled={isLoading}
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Télécharger le planning en PDF
          {userName && <span className="text-sm text-gray-500 block mt-1">{userName}</span>}
        </h3>

        {/* Sélection de dates */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center space-x-2 text-sm text-gray-700">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="font-medium">Période à exporter</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="startDate" className="block text-xs font-medium text-gray-600 mb-1">
                Date de début
              </label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={isLoading}
              />
            </div>
            
            <div>
              <label htmlFor="endDate" className="block text-xs font-medium text-gray-600 mb-1">
                Date de fin
              </label>
              <input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={isLoading}
              />
            </div>
          </div>
          
          <div className="text-xs text-gray-500 text-center">
            Par défaut : les 4 derniers mois
          </div>
        </div>

        {/* Options d'export */}
        <div className="space-y-4">
          <button
            onClick={() => {
              const start = new Date(startDate);
              const end = new Date(endDate);
              onExportWithoutDesiderata(start, end);
            }}
            disabled={isLoading || !startDate || !endDate}
            className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Export en cours...' : 'Planning seul'}
          </button>

          <button
            onClick={() => {
              const start = new Date(startDate);
              const end = new Date(endDate);
              onExportWithDesiderata(start, end);
            }}
            disabled={isLoading || !startDate || !endDate}
            className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Export en cours...' : 'Planning avec desiderata'}
          </button>

          <div className="pt-2 text-xs text-gray-500 text-center">
            Le planning avec desiderata affiche les préférences de garde en couleur
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportPDFModal;