import React, { useState } from 'react';
import { format, differenceInDays, isAfter, isBefore, addYears } from 'date-fns';
import { fr } from 'date-fns/locale';
import { X, Calendar, Download, FileSpreadsheet } from 'lucide-react';
import { exportPlanningToAstreinte } from '../../../../utils/astreinteExport';
import { useToast } from '../../../../hooks/useToast';
import { createParisDate, formatParisDate, parseParisDate, startOfMonthParis, endOfMonthParis } from '../../../../utils/timezoneUtils';

interface ExportAstreinteModalProps {
  associationId: string;
  onClose: () => void;
}

export const ExportAstreinteModal: React.FC<ExportAstreinteModalProps> = ({ associationId, onClose }) => {
  const currentDate = createParisDate();
  const [exportMode, setExportMode] = useState<'month' | 'custom'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>(formatParisDate(currentDate, 'yyyy-MM'));
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const { showToast } = useToast();

  const handleExport = async () => {
    let exportStartDate: Date;
    let exportEndDate: Date;

    if (exportMode === 'month') {
      const [year, month] = selectedMonth.split('-').map(Number);
      
      exportStartDate = startOfMonthParis(createParisDate(year, month - 1, 1));
      exportEndDate = endOfMonthParis(createParisDate(year, month - 1, 1));
    } else {
      if (!startDate || !endDate) {
        showToast({
          type: 'error',
          message: 'Veuillez sélectionner les dates de début et de fin'
        });
        return;
      }

      exportStartDate = parseParisDate(startDate);
      exportEndDate = parseParisDate(endDate);

      // Validation des dates
      if (isAfter(exportStartDate, exportEndDate)) {
        showToast({
          type: 'error',
          message: 'La date de fin doit être après la date de début'
        });
        return;
      }

      // Limite à 1 an maximum
      const maxDate = addYears(exportStartDate, 1);
      if (isAfter(exportEndDate, maxDate)) {
        showToast({
          type: 'error',
          message: 'La période ne peut pas dépasser 1 an'
        });
        return;
      }
    }


    setIsExporting(true);
    try {
      await exportPlanningToAstreinte(exportStartDate, exportEndDate, associationId, exportMode === 'month');
      showToast({
        type: 'success',
        message: 'Export des astreintes réussi'
      });
      onClose();
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      showToast({
        type: 'error',
        message: 'Erreur lors de l\'export du fichier d\'astreinte'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const dayCount = exportMode === 'custom' && startDate && endDate 
    ? differenceInDays(createParisDate(endDate), createParisDate(startDate)) + 1 
    : exportMode === 'month' 
    ? new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]), 0).getDate()
    : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={24} className="text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-800">
              Export Astreintes
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Fermer"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Générer le fichier Excel des astreintes pour le paiement des médecins
          </p>
        </div>

        <div className="space-y-4">
          {/* Mode de sélection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Période d'export
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setExportMode('month')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  exportMode === 'month'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Mois complet
              </button>
              <button
                onClick={() => setExportMode('custom')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  exportMode === 'custom'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Période personnalisée
              </button>
            </div>
          </div>

          {exportMode === 'month' ? (
            <div>
              <label htmlFor="month" className="block text-sm font-medium text-gray-700 mb-1">
                Sélectionner le mois
              </label>
              <div className="relative">
                <input
                  type="month"
                  id="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Calendar className="absolute left-3 top-2.5 text-gray-400" size={18} />
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}

          {dayCount > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-sm text-blue-800">
                Période : <span className="font-semibold">{dayCount} jour{dayCount > 1 ? 's' : ''}</span>
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Le fichier contiendra toutes les gardes d'astreinte sur cette période
              </p>
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
            <p className="text-xs text-gray-600">
              <strong>Format du fichier :</strong> Excel (.xlsx) compatible avec le système de paiement
            </p>
            <p className="text-xs text-gray-600 mt-1">
              <strong>Créneaux horaires :</strong> 00:00-08:00 et 20:00-24:00
            </p>
          </div>
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
            disabled={isExporting || (exportMode === 'custom' && (!startDate || !endDate))}
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