import React, { useState } from 'react';
import { createParisDate } from '@/utils/timezoneUtils';
import { BarChart3, PieChart, Calendar } from 'lucide-react';
import { useDesiderataStatistics, useArchivedDesiderata } from '../hooks';
import { usePlanningConfig } from '../../../context/planning/PlanningContext';
import { useAssociation } from '../../../context/association/AssociationContext';
import AssociationBadge from '../components/common/AssociationBadge';
import ExportButtons from '../components/common/ExportButtons';
import StatsOverview from '../components/DesiderataStats/StatsOverview';
import DesiderataTable from '../components/DesiderataStats/DesiderataTable';
import ImprovedDesiderataBarChart from '../components/charts/ImprovedDesiderataBarChart';
import ImprovedTrendsLineChart from '../components/charts/ImprovedTrendsLineChart';
import CalendarHeatmap from '../components/charts/CalendarHeatmap';
import DoctorDesiderataChart from '../components/charts/DoctorDesiderataChart';
import YearComparisonChart from '../components/charts/YearComparisonChart';
import { SchoolPeriodDesiderataChart } from '../components/charts/SchoolPeriodDesiderataChart';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import Toast from '../../../components/common/Toast';
import type { StatsFilter } from '../types';

type TabType = 'heatmap' | 'overview' | 'charts';

const StatisticsPage: React.FC = () => {
  const { currentAssociation } = useAssociation();
  const { config } = usePlanningConfig();
  const [activeTab, setActiveTab] = useState<TabType>('heatmap');
  const [filter] = useState<StatsFilter>({});
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  const [showAvailability, setShowAvailability] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  
  const { 
    loading, 
    error, 
    dailyStats, 
    doctorStats, 
    periodAnalysis,
    periodInfo,
    associationUsers
  } = useDesiderataStatistics(filter);
  
  const { 
    previousYearStats, 
    loading: loadingArchived,
    error: _archivedError 
  } = useArchivedDesiderata(
    config.startDate || createParisDate(),
    config.endDate || createParisDate()
  );

  // Filtrer pour obtenir uniquement les jours critiques (> 50% d'indisponibilité)
  const criticalDays = dailyStats.filter(day => day.overallPercentage > 50);
  
  // Filtrer pour les weekends et jours fériés
  const specialDays = dailyStats.filter(day => day.isWeekend || day.isHoliday);

  const handleExportPDF = () => {
    setShowExportModal(true);
  };

  const handleMatrixExport = async (exportType: 'all' | 'primary' | 'secondary' | 'availability') => {
    try {
      const { exportMatrixToPDF } = await import('../utils/matrixPdfExport');
      exportMatrixToPDF({
        stats: dailyStats,
        exportType,
        associationName: currentAssociation
      });
      
      setToast({
        visible: true,
        message: 'Export PDF généré avec succès',
        type: 'success'
      });
    } catch (error) {
      setToast({
        visible: true,
        message: 'Erreur lors de l\'export PDF',
        type: 'error'
      });
    } finally {
      setShowExportModal(false);
    }
  };

  const tabs = [
    {
      id: 'heatmap' as TabType,
      label: 'Matrice des indispo',
      icon: Calendar
    },
    {
      id: 'overview' as TabType,
      label: 'Vue d\'ensemble',
      icon: BarChart3
    },
    {
      id: 'charts' as TabType,
      label: 'Graphiques',
      icon: PieChart
    }
  ];

  if (!config.isConfigured) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-yellow-50 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">Configuration requise</h2>
          <p className="text-yellow-700">
            Les desiderata doivent être configurés avant de pouvoir consulter les statistiques.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <Toast 
        message={toast.message}
        isVisible={toast.visible}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, visible: false }))}
      />

      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Statistiques des desiderata</h1>
          <p className="mt-1 text-gray-600">
            Analyse des demandes d'indisponibilité pour la période en cours
          </p>
        </div>
        <div className="flex items-center gap-4">
          <AssociationBadge association={currentAssociation} />
          <ExportButtons 
            onExportPDF={handleExportPDF}
            disabled={loading}
          />
        </div>
      </div>

      {/* Onglets */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <tab.icon className="h-5 w-5 mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenu */}
      {loading || loadingArchived ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="bg-red-50 p-6 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      ) : (
        <div className="mt-6">
          {activeTab === 'heatmap' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={() => setShowAvailability(!showAvailability)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  {showAvailability ? 'Voir les indisponibilités' : 'Voir les disponibilités'}
                </button>
              </div>
              
              <CalendarHeatmap 
                stats={dailyStats}
                showAvailability={showAvailability}
                onDayClick={(day) => {
                  setToast({
                    visible: true,
                    message: `${day.date}: ${showAvailability ? 100 - day.overallPercentage : day.overallPercentage}% ${showAvailability ? 'de disponibilité' : 'd\'indisponibilité'}`,
                    type: 'info'
                  });
                }}
              />
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="space-y-6">
              <StatsOverview analysis={periodAnalysis} />
              
              {/* Jours critiques */}
              {criticalDays.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Jours critiques ({criticalDays.length})
                  </h3>
                  <div className="overflow-x-auto">
                    <DesiderataTable stats={criticalDays.slice(0, 10)} />
                  </div>
                </div>
              )}

              {/* Weekends et jours fériés */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Weekends et jours fériés
                </h3>
                <div className="overflow-x-auto">
                  <DesiderataTable stats={specialDays} />
                </div>
              </div>
            </div>
          )}


          {activeTab === 'charts' && (
            <div className="space-y-6">
              {/* Graphique principal : Desiderata par médecin */}
              <div className="col-span-full">
                <DoctorDesiderataChart 
                  doctorStats={doctorStats} 
                  periodInfo={periodInfo}
                  users={associationUsers}
                />
              </div>
              
              {/* Comparaison avec l'année précédente */}
              {!loadingArchived && (
                <div className="col-span-full">
                  <YearComparisonChart 
                    currentYearStats={dailyStats} 
                    previousYearStats={previousYearStats}
                  />
                </div>
              )}
              
              {/* Analyse des périodes scolaires */}
              <div className="col-span-full">
                <SchoolPeriodDesiderataChart stats={dailyStats} />
              </div>
              
              {/* Graphiques améliorés en pleine largeur */}
              <div className="space-y-6">
                <ImprovedDesiderataBarChart stats={dailyStats} doctorStats={doctorStats} />
                <ImprovedTrendsLineChart stats={dailyStats} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal d'export */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">​</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Choisir le type d'export
                </h3>
                <div className="space-y-3">
                  <button
                    onClick={() => handleMatrixExport('all')}
                    className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-indigo-500 transition-colors"
                  >
                    <div className="font-medium text-gray-900">Tous les types d'indisponibilités</div>
                    <div className="text-sm text-gray-500">Affiche toutes les indisponibilités (primaires et secondaires)</div>
                  </button>
                  
                  <button
                    onClick={() => handleMatrixExport('primary')}
                    className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-indigo-500 transition-colors"
                  >
                    <div className="font-medium text-gray-900">Indisponibilités primaires uniquement</div>
                    <div className="text-sm text-gray-500">Affiche seulement les desiderata primaires</div>
                  </button>
                  
                  <button
                    onClick={() => handleMatrixExport('secondary')}
                    className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-indigo-500 transition-colors"
                  >
                    <div className="font-medium text-gray-900">Indisponibilités secondaires uniquement</div>
                    <div className="text-sm text-gray-500">Affiche seulement les desiderata secondaires</div>
                  </button>
                  
                  <button
                    onClick={() => handleMatrixExport('availability')}
                    className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-green-500 transition-colors"
                  >
                    <div className="font-medium text-green-700">Matrice des disponibilités</div>
                    <div className="text-sm text-gray-500">Affiche les pourcentages de médecins disponibles</div>
                  </button>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatisticsPage;