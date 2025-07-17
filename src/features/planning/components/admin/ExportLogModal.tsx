import React, { useState } from 'react';
import { format, differenceInDays, isAfter, isBefore, addYears } from 'date-fns';
import { fr } from 'date-fns/locale';
import { X, Calendar, Download } from 'lucide-react';
import { exportPlanningToLog } from '../../../../utils/planningLogExport';
import { useToast } from '../../../../hooks/useToast';

interface ExportLogModalProps {
  associationId: string;
  onClose: () => void;
}

export const ExportLogModal: React.FC<ExportLogModalProps> = ({ associationId, onClose }) => {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const { showToast } = useToast();

  const handleExport = async () => {
    if (!startDate || !endDate) {
      showToast({
        type: 'error',
        message: 'Veuillez sélectionner les dates de début et de fin'
      });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validation des dates
    if (isAfter(start, end)) {
      showToast({
        type: 'error',
        message: 'La date de fin doit être après la date de début'
      });
      return;
    }

    if (isBefore(end, start)) {
      showToast({
        type: 'error',
        message: 'La date de début doit être avant la date de fin'
      });
      return;
    }

    // Limite à 1 an maximum
    const maxDate = addYears(start, 1);
    if (isAfter(end, maxDate)) {
      showToast({
        type: 'error',
        message: 'La période ne peut pas dépasser 1 an'
      });
      return;
    }

    setIsExporting(true);
    try {
      await exportPlanningToLog(start, end, associationId);
      showToast({
        type: 'success',
        message: 'Export réussi'
      });
      onClose();
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      showToast({
        type: 'error',
        message: 'Erreur lors de l\'export du fichier'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const dayCount = startDate && endDate 
    ? differenceInDays(new Date(endDate), new Date(startDate)) + 1 
    : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">
            Export Planning Archive (.log)
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Fermer"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
              Date de début
            </label>
            <div className="relative">
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <Calendar className="absolute left-3 top-2.5 text-gray-400" size={18} />
            </div>
          </div>

          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
              Date de fin
            </label>
            <div className="relative">
              <input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <Calendar className="absolute left-3 top-2.5 text-gray-400" size={18} />
            </div>
          </div>

          {startDate && endDate && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-sm text-blue-800">
                Période : <span className="font-semibold">{dayCount} jour{dayCount > 1 ? 's' : ''}</span>
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            disabled={isExporting}
          >
            Annuler
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || !startDate || !endDate}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Export en cours...
              </>
            ) : (
              <>
                <Download size={18} />
                Exporter
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};