import React, { useState } from 'react';
import { X, Download, FileSpreadsheet, Filter, Calendar } from 'lucide-react';
import { createParisDate, formatParisDate } from '../utils/timezoneUtils';

interface ExportOptions {
  exportType: 'simple' | 'detailed';
  dateRange: 'all' | 'custom';
  startDate?: string;
  endDate?: string;
  includeAssigned: boolean;
  includePending: boolean;
  includeMetadata: boolean;
}

interface ReplacementExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
  totalCount: number;
  assignedCount: number;
  pendingCount: number;
}

export const ReplacementExportModal: React.FC<ReplacementExportModalProps> = ({
  isOpen,
  onClose,
  onExport,
  totalCount,
  assignedCount,
  pendingCount
}) => {
  const [options, setOptions] = useState<ExportOptions>({
    exportType: 'simple',
    dateRange: 'all',
    includeAssigned: true,
    includePending: true,
    includeMetadata: false
  });

  if (!isOpen) return null;

  const handleExport = () => {
    onExport(options);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <FileSpreadsheet className="h-5 w-5 text-indigo-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Options d'export</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Type d'export */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type d'export
            </label>
            <div className="space-y-2">
              <label className="flex items-start">
                <input
                  type="radio"
                  value="simple"
                  checked={options.exportType === 'simple'}
                  onChange={(e) => setOptions({ ...options, exportType: 'simple' })}
                  className="mt-1 mr-3"
                />
                <div>
                  <div className="font-medium text-sm">Export simple</div>
                  <div className="text-xs text-gray-500">Colonnes de base uniquement</div>
                </div>
              </label>
              <label className="flex items-start">
                <input
                  type="radio"
                  value="detailed"
                  checked={options.exportType === 'detailed'}
                  onChange={(e) => setOptions({ ...options, exportType: 'detailed' })}
                  className="mt-1 mr-3"
                />
                <div>
                  <div className="font-medium text-sm">Export détaillé</div>
                  <div className="text-xs text-gray-500">Inclut les dates de création, l'historique et les métadonnées</div>
                </div>
              </label>
            </div>
          </div>

          {/* Filtres de statut */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter className="inline h-4 w-4 mr-1" />
              Filtres de statut
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.includeAssigned}
                  onChange={(e) => setOptions({ ...options, includeAssigned: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm">Remplacements assignés ({assignedCount})</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.includePending}
                  onChange={(e) => setOptions({ ...options, includePending: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm">Remplacements en attente ({pendingCount})</span>
              </label>
            </div>
          </div>

          {/* Période */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline h-4 w-4 mr-1" />
              Période
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="all"
                  checked={options.dateRange === 'all'}
                  onChange={(e) => setOptions({ ...options, dateRange: 'all' })}
                  className="mr-2"
                />
                <span className="text-sm">Toutes les dates</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="custom"
                  checked={options.dateRange === 'custom'}
                  onChange={(e) => setOptions({ ...options, dateRange: 'custom' })}
                  className="mr-2"
                />
                <span className="text-sm">Période personnalisée</span>
              </label>
            </div>
            
            {options.dateRange === 'custom' && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500">Du</label>
                  <input
                    type="date"
                    value={options.startDate || ''}
                    onChange={(e) => setOptions({ ...options, startDate: e.target.value })}
                    className="mt-1 block w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500">Au</label>
                  <input
                    type="date"
                    value={options.endDate || ''}
                    onChange={(e) => setOptions({ ...options, endDate: e.target.value })}
                    className="mt-1 block w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Options supplémentaires */}
          {options.exportType === 'detailed' && (
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.includeMetadata}
                  onChange={(e) => setOptions({ ...options, includeMetadata: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm">Inclure les métadonnées (date de création, modifications)</span>
              </label>
            </div>
          )}
        </div>

        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              {(() => {
                let count = 0;
                if (options.includeAssigned) count += assignedCount;
                if (options.includePending) count += pendingCount;
                return `${count} remplacement(s) à exporter`;
              })()}
            </p>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleExport}
                disabled={!options.includeAssigned && !options.includePending}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4 mr-2" />
                Exporter
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};