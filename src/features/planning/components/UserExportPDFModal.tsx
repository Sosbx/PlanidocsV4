import React, { useState, useEffect } from 'react';
import { createParisDate, subMonthsParis, formatParisDate } from '@/utils/timezoneUtils';
import { X, FileText, Calendar } from 'lucide-react';
import { format, subMonths, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useShiftExchangeCore } from '../../shiftExchange/hooks/useShiftExchangeCore';
import { usePlanningConfig } from '../../../context/planning/PlanningContext';

interface UserExportPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (showAssignmentsOnly: boolean, startDate: Date, endDate: Date) => void;
  userName: string;
}

export const UserExportPDFModal: React.FC<UserExportPDFModalProps> = ({
  isOpen,
  onClose,
  onExport,
  userName
}) => {
  const { config } = usePlanningConfig();
  const { exchanges } = useShiftExchangeCore({ limitResults: 500 });
  
  const [showAssignmentsOnly, setShowAssignmentsOnly] = useState(true);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [maxDate, setMaxDate] = useState<string>('');
  
  // Calculer les dates par défaut en fonction de la bourse aux gardes
  useEffect(() => {
    if (!config) return;
    
    // Si des échanges existent, utiliser leur plage de dates
    if (exchanges && exchanges.length > 0) {
      // Trouver la première et dernière date des échanges
      const exchangeDates = exchanges.map(ex => new Date(ex.date));
      const minExchangeDate = new Date(Math.min(...exchangeDates.map(d => d.getTime())));
      const maxExchangeDate = new Date(Math.max(...exchangeDates.map(d => d.getTime())));
      
      // Utiliser les dates exactes de la bourse aux gardes
      setStartDate(formatParisDate(minExchangeDate, 'yyyy-MM-dd'));
      setEndDate(formatParisDate(maxExchangeDate, 'yyyy-MM-dd'));
      setMaxDate(formatParisDate(maxExchangeDate, 'yyyy-MM-dd'));
    } else {
      // Sinon, utiliser 4 mois avant la fin du planning actuel
      const planningEndDate = config.endDate || createParisDate();
      const defaultStartDate = subMonthsParis(planningEndDate, 3); // 4 mois avant = -3 mois
      
      setStartDate(formatParisDate(defaultStartDate, 'yyyy-MM-dd'));
      setEndDate(formatParisDate(planningEndDate, 'yyyy-MM-dd'));
      setMaxDate(formatParisDate(planningEndDate, 'yyyy-MM-dd'));
    }
  }, [config, exchanges]);

  if (!isOpen) return null;

  const handleExport = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // S'assurer que les dates sont valides
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return;
    }
    
    if (start > end) {
      return;
    }
    
    onExport(showAssignmentsOnly, start, end);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl max-w-md w-full shadow-xl">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-xl font-semibold text-gray-900">
            Options d'export PDF
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900">
              Sélectionnez le format d'export
            </h4>
            
            <label className="flex items-start space-x-3 cursor-pointer group">
              <input
                type="radio"
                name="exportType"
                checked={showAssignmentsOnly}
                onChange={() => setShowAssignmentsOnly(true)}
                className="mt-1 w-4 h-4 text-teal-600 border-gray-300 focus:ring-teal-500"
              />
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-gray-600 group-hover:text-teal-600 transition-colors" />
                  <span className="font-medium text-gray-900 group-hover:text-teal-600 transition-colors">
                    Planning seul
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Export simple avec uniquement vos gardes assignées
                </p>
              </div>
            </label>
            
            <label className="flex items-start space-x-3 cursor-pointer group">
              <input
                type="radio"
                name="exportType"
                checked={!showAssignmentsOnly}
                onChange={() => setShowAssignmentsOnly(false)}
                className="mt-1 w-4 h-4 text-teal-600 border-gray-300 focus:ring-teal-500"
              />
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-gray-600 group-hover:text-teal-600 transition-colors" />
                  <span className="font-medium text-gray-900 group-hover:text-teal-600 transition-colors">
                    Planning avec desiderata
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Export détaillé incluant vos choix de desiderata et commentaires
                </p>
              </div>
            </label>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-600" />
              Période à exporter
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de début
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de fin
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  max={maxDate}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>
            
            {exchanges && exchanges.length > 0 && startDate && endDate && (
              <p className="text-sm text-gray-500 italic">
                Période de la bourse aux gardes : du {formatParisDate(new Date(startDate), 'dd MMMM yyyy', { locale: fr })} au {formatParisDate(new Date(maxDate), 'dd MMMM yyyy', { locale: fr })}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleExport}
            disabled={!startDate || !endDate || new Date(startDate) > new Date(endDate)}
            className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Exporter
          </button>
        </div>
      </div>
    </div>
  );
};