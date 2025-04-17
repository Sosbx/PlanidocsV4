import React, { useState } from 'react';
import { Download, FileText, FileSpreadsheet, Calendar, Eye, EyeOff, ChevronDown } from 'lucide-react';

interface PlanningToolbarProps {
  onExportPDF: () => Promise<void>;
  onExportCSV: () => Promise<void>;
  onExportAllPDF?: () => Promise<void>;
  onExportAllCSV?: () => Promise<void>;
  onToggleDesiderata: () => void;
  showDesiderata: boolean;
  isLoading?: boolean;
}

/**
 * Barre d'outils pour les actions sur le planning
 */
const PlanningToolbar: React.FC<PlanningToolbarProps> = ({
  onExportPDF,
  onExportCSV,
  onExportAllPDF,
  onExportAllCSV,
  onToggleDesiderata,
  showDesiderata,
  isLoading = false
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // Forcer le re-rendu lorsque showDesiderata change
  React.useEffect(() => {
    console.log("PlanningToolbar: showDesiderata a changé:", showDesiderata);
    // Cet effet ne fait rien, mais force le composant à se re-rendre
    // lorsque showDesiderata change
  }, [showDesiderata]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleDesiderata}
          className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          title={showDesiderata ? "Masquer les desiderata" : "Afficher les desiderata"}
        >
          {showDesiderata ? (
            <>
              <EyeOff className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Masquer</span> desiderata
            </>
          ) : (
            <>
              <Eye className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Afficher</span> desiderata
            </>
          )}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            disabled={isLoading}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Exporter
            <ChevronDown className={`ml-1.5 h-3 w-3 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
          </button>
          
          {showExportMenu && (
            <>
              <div 
                className="fixed inset-0 z-10"
                onClick={() => setShowExportMenu(false)}
              />
              <div className="absolute right-0 mt-1 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20">
                <div className="py-1" role="menu">
                  {/* Export individuel */}
                  <div className="px-3 py-2 text-xs font-medium text-gray-500">
                    Utilisateur actuel
                  </div>
                  <button
                    onClick={() => {
                      onExportPDF();
                      setShowExportMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    role="menuitem"
                    disabled={isLoading}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    PDF
                  </button>
                  <button
                    onClick={() => {
                      onExportCSV();
                      setShowExportMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    role="menuitem"
                    disabled={isLoading}
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    CSV
                  </button>
                  
                  {/* Export de tous les utilisateurs */}
                  {(onExportAllPDF || onExportAllCSV) && (
                    <>
                      <div className="border-t border-gray-100 my-1"></div>
                      <div className="px-3 py-2 text-xs font-medium text-gray-500">
                        Tous les utilisateurs
                      </div>
                      {onExportAllPDF && (
                        <button
                          onClick={() => {
                            onExportAllPDF();
                            setShowExportMenu(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                          role="menuitem"
                          disabled={isLoading}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Tous les PDF
                        </button>
                      )}
                      {onExportAllCSV && (
                        <button
                          onClick={() => {
                            onExportAllCSV();
                            setShowExportMenu(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                          role="menuitem"
                          disabled={isLoading}
                        >
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          Tous les CSV
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlanningToolbar;
