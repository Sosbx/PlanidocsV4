import React, { useState, useEffect } from 'react';
import { Calendar, Download, HelpCircle, X, Mail, Grid, Settings, FileSpreadsheet, Import, CheckCircle2 } from 'lucide-react';
import { ChevronDown, FileText } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { doc, onSnapshot, collection, getDocs, query, where } from 'firebase/firestore';
import { exportPlanningToICS } from '../utils/icsExport';
import { useBagPhase } from '../context/BagPhaseContext';
import { Switch } from '../components/common/Switch';
import { Info, Clock, AlertTriangle } from 'lucide-react';
import { db } from '../lib/firebase/config';
import { exportPlanningToGoogleCalendarCSV } from '../utils/csvExport';
import { getTimeRemaining } from '../utils/timeUtils';
import { exportPlanningToPDF } from '../utils/pdfExport';
import { usePlanningConfig } from '../context/PlanningContext';
import GeneratedPlanningTable from '../components/planning/GeneratedPlanningTable';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PlanningTutorial from '../components/planning/PlanningTutorial';
import type { GeneratedPlanning, ExchangeHistory } from '../types/planning';
import Toast from '../components/Toast';
import { getDesiderata } from '../lib/firebase/desiderata';

const UserPlanningPage: React.FC = () => {
  const { user } = useAuth();
  const { config } = usePlanningConfig();
  const { config: bagPhaseConfig } = useBagPhase();
  const [planning, setPlanning] = useState<GeneratedPlanning | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDesiderata, setShowDesiderata] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });
  const [showImportHelp, setShowImportHelp] = useState(false);
  const [desiderata, setDesiderata] = useState<Record<string, 'primary' | 'secondary' | null>>({});
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [timeLeft, setTimeLeft] = useState(getTimeRemaining(bagPhaseConfig.submissionDeadline));
  const [receivedShifts, setReceivedShifts] = useState<Record<string, { 
    originalUserId: string; 
    newUserId: string; 
    isPermutation: boolean;
    shiftType: string;
    timeSlot: string;
  }>>({});

  // Charger les desiderata pour l'export
  useEffect(() => {
    if (!user) return;
    const loadDesiderata = async () => {
      try {
        const data = await getDesiderata(user.id);
        if (data?.selections) {
          setDesiderata(data.selections);
        }
      } catch (error) {
        console.error('Error loading desiderata:', error);
      }
    };
    loadDesiderata();
  }, [user]);
  // Update timeLeft every second during submission phase
  useEffect(() => {
    if (bagPhaseConfig.phase !== 'submission') return;

    const timer = setInterval(() => {
      const remaining = getTimeRemaining(bagPhaseConfig.submissionDeadline);
      setTimeLeft(remaining);
      
      if (remaining.isExpired) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [bagPhaseConfig.submissionDeadline, bagPhaseConfig.phase]);

  const handleExportCSV = () => {
    if (!planning || !user) {
      setToast({
        visible: true,
        message: 'Aucun planning disponible à exporter',
        type: 'error'
      });
      return;
    }

    try {
      // Utiliser les assignments du planning actuel
      exportPlanningToGoogleCalendarCSV(
        planning.assignments,
        `${user.lastName}_${user.firstName}`
      );
    } catch (error) {
      console.error('Error exporting CSV:', error);
      setToast({
        visible: true,
        message: 'Erreur lors de l\'export du planning',
        type: 'error'
      });
    }
  };

  useEffect(() => {
    if (!user) return;

    // Charger l'historique des échanges pour identifier les gardes reçues
    const loadExchangeHistory = async () => {
      try {
        // Utiliser une requête avec where pour filtrer directement les échanges pertinents
        const historyQuery = query(
          collection(db, 'exchange_history'),
          where('status', '==', 'completed')
        );
        
        const historySnapshot = await getDocs(historyQuery);
        const receivedShiftsData: Record<string, { 
          originalUserId: string; 
          newUserId: string; 
          isPermutation: boolean;
          shiftType: string;
          timeSlot: string;
        }> = {};

        historySnapshot.docs.forEach(doc => {
          const history = doc.data() as ExchangeHistory;
          
          // Ne prendre en compte que les échanges complétés (non annulés) et où cet utilisateur est impliqué
          if (history.status === 'completed' && 
              (history.originalUserId === user.id || history.newUserId === user.id)) {
            const key = `${history.date}-${history.period}`;
            receivedShiftsData[key] = {
              originalUserId: history.originalUserId,
              newUserId: history.newUserId,
              isPermutation: Boolean(history.isPermutation),
              shiftType: history.shiftType,
              timeSlot: history.timeSlot
            };
          }
        });

        setReceivedShifts(receivedShiftsData);
      } catch (error) {
        console.error('Error loading exchange history:', error);
      }
    };

    // Charger le planning de l'utilisateur en temps réel
    const unsubscribe = onSnapshot(
      doc(db, 'generated_plannings', user.id),
      (doc) => {
        setLoading(false);
        if (doc.exists()) {
          const data = doc.data() as GeneratedPlanning;
          // Convertir le timestamp Firestore en Date
          const uploadedAt = data.uploadedAt?.toDate?.() || new Date(data.uploadedAt);
          setPlanning({
            ...data,
            uploadedAt
          });
        } else {
          setPlanning(null);
        }
      },
      (error) => {
        console.error('Error loading planning:', error);
        setError('Erreur lors du chargement du planning');
        setLoading(false);
      }
    );

    // Écouter également les changements dans les échanges
    const unsubscribeExchangeHistory = onSnapshot(
      collection(db, 'exchange_history'),
      async () => {
        // Recharger l'historique des échanges quand il y a des changements
        await loadExchangeHistory();
      },
      (error) => {
        console.error('Error monitoring exchange history:', error);
      }
    );

    // Chargement initial
    loadExchangeHistory();

    // Nettoyage à la désactivation du composant
    return () => {
      unsubscribe();
      unsubscribeExchangeHistory();
    };
  }, [user]);

  if (!user?.roles.isUser) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-yellow-50 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">Accès non autorisé</h2>
          <p className="text-yellow-700">
            Vous n'avez pas accès à cette page.
          </p>
        </div>
      </div>
    );
  }

  if (!config.isConfigured) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-yellow-50 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">Planning non configuré</h2>
          <p className="text-yellow-700">
            Le planning n'a pas encore été configuré par l'administrateur.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Erreur</h2>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Toast 
        message={toast.message}
        isVisible={toast.visible}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, visible: false }))}
      />

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Calendar className="h-6 w-6 text-indigo-600 mr-2" />
              <h1 className="text-2xl font-bold text-gray-900">Mon Planning</h1>
            </div>
            {planning && (
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="flex gap-2">
                  <div className="relative">
                    <button
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      title="Exporter le planning"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      <span>Exporter</span>
                      <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showExportMenu && (
                      <>
                        <div 
                          className="fixed inset-0 z-10"
                          onClick={() => setShowExportMenu(false)}
                        />
                        <div className="absolute right-0 mt-1 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20">
                          <div className="py-1" role="menu">
                            <button
                              onClick={() => {
                                handleExportCSV();
                                setShowExportMenu(false);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                              role="menuitem"
                            >
                              <FileSpreadsheet className="h-4 w-4 mr-2" />
                              CSV (Google Calendar)
                            </button>
                            <button
                              onClick={() => {
                                if (!planning || !user) return;
                                exportPlanningToICS(
                                  planning.assignments,
                                  `${user.lastName}_${user.firstName}`
                                );
                                setShowExportMenu(false);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                              role="menuitem"
                            >
                              <Calendar className="h-4 w-4 mr-2" />
                              ICS (Apple Calendar)
                            </button>
                            <button
                              onClick={() => {
                                setShowDownloadModal(true);
                                setShowExportMenu(false);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                              role="menuitem"
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              PDF
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => setShowImportHelp(true)}
                    className="inline-flex items-center px-3 py-2 border border-indigo-300 shadow-sm text-sm font-medium rounded-md text-indigo-700 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    title="Comment importer dans Google Calendar"
                  >
                    <HelpCircle className="h-4 w-4 mr-2" />
                    <span>Aide importation</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">Afficher les desiderata</span>
              <Switch
                data-tutorial="toggle-desiderata"
                checked={showDesiderata}
                onChange={setShowDesiderata}
                className="relative inline-flex h-6 w-11 items-center rounded-full"
              />
            </div>
            <button
              onClick={() => setShowTutorial(true)}
              className="group inline-flex items-center justify-center p-2 sm:px-4 sm:py-2 border-2 border-orange-300 rounded-lg shadow-md text-base font-medium text-orange-800 bg-gradient-to-b from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 hover:border-orange-400 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transform hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
            >
              <HelpCircle className="h-5 w-5 mr-2 text-orange-500 group-hover:text-orange-600 group-hover:rotate-12 transition-all duration-200" />
              <span className="hidden sm:inline">TUTORIEL</span>
            </button>
          </div>
        </div>

        {planning ? (
          <>
            <div className="mb-4 text-sm text-gray-500">
              Dernière mise à jour : {planning.uploadedAt.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
            {/* Phase de la bourse aux gardes */}
            <div className="mb-2 text-xs">
              {bagPhaseConfig.phase === 'submission' ? (
                <div className="inline-flex items-center text-blue-700 bg-blue-50 px-3 py-1.5 rounded-md">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <Clock className="h-4 w-4" />
                    <span>BàG disponible</span>
                    <div className="flex items-center gap-1 text-blue-900 font-medium">
                      <span className="md:hidden">
                        {timeLeft.days > 0 ? `${timeLeft.days}j ` : ''}
                        {String(timeLeft.hours).padStart(2, '0')}h
                      </span>
                      <span className="hidden md:inline">
                        {timeLeft.days > 0 && (
                          <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100">
                            {timeLeft.days}j
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 ml-1">
                          <span className="px-2 py-1 rounded-md bg-blue-100">{String(timeLeft.hours).padStart(2, '0')}</span>:
                          <span className="px-2 py-1 rounded-md bg-blue-100">{String(timeLeft.minutes).padStart(2, '0')}</span>:
                          <span className="px-2 py-1 rounded-md bg-blue-100">{String(timeLeft.seconds).padStart(2, '0')}</span>
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              ) : bagPhaseConfig.phase === 'distribution' ? (
                <div className="inline-flex items-center text-yellow-700 bg-yellow-50 px-3 py-1.5 rounded-md">
                  <AlertTriangle className="h-4 w-4 mr-1.5" />
                  <span>Phase de répartition - Échanges temporairement suspendus</span>
                </div>
              ) : (
                <div className="inline-flex items-center text-green-700 bg-green-50 px-3 py-1.5 rounded-md">
                  <Info className="h-4 w-4 mr-1.5" />
                  <span>Phase terminée - Échanges validés et intégrés</span>
                </div>
              )}
            </div>
            <div data-tutorial="planning-grid">
              <GeneratedPlanningTable
                startDate={config.startDate}
                endDate={config.endDate}
                assignments={planning.assignments}
                userId={user?.id}
                showDesiderata={showDesiderata}
                receivedShifts={receivedShifts}
              />
            </div>
          </>
        ) : (
          <div className="bg-yellow-50 p-6 rounded-lg">
            <h2 className="text-lg font-medium text-yellow-800 mb-2">
              Planning en cours de création
            </h2>
            <p className="text-yellow-700">
              Votre planning n'a pas encore été importé par l'administrateur. 
              Il sera affiché ici dès qu'il sera disponible.
            </p>
          </div>
        )}
      </div>
      <PlanningTutorial isOpen={showTutorial} onClose={() => setShowTutorial(false)} />
      
      {/* Modal de téléchargement PDF */}
      {showDownloadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Télécharger le planning en PDF
            </h3>
            <div className="space-y-4">
              <button
                onClick={() => {
                  if (!planning || !user) return;
                  exportPlanningToPDF({
                    userName: `${user.lastName} ${user.firstName}`,
                    startDate: config.startDate,
                    endDate: config.endDate,
                    assignments: planning.assignments,
                    showAssignmentsOnly: true
                  });
                  setShowDownloadModal(false);
                }}
                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Planning seul
              </button>
              <button
                onClick={() => {
                  if (!planning || !user) return;
                  exportPlanningToPDF({
                    userName: `${user.lastName} ${user.firstName}`,
                    startDate: config.startDate,
                    endDate: config.endDate,
                    assignments: planning.assignments,
                    desiderata: desiderata,
                    showAssignmentsOnly: false,
                    showComments: true
                  });
                  setShowDownloadModal(false);
                }}
                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Planning avec desiderata
              </button>
              <div className="pt-4 flex justify-end">
                <button
                  onClick={() => setShowDownloadModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'aide à l'importation */}
      {showImportHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-full">
                  <Import className="h-6 w-6 text-indigo-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Importer votre planning dans Google Calendar
                </h3>
              </div>
              <button
                onClick={() => setShowImportHelp(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Fermer</span>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-6 space-y-6">
              <ol className="space-y-6">
                <li className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 p-2 bg-blue-100 rounded-full">
                    <Mail className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Connectez-vous à votre compte GmailH24</p>
                    <p className="mt-1 text-sm text-gray-600">Utilisez un ordinateur pour une meilleure expérience</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 p-2 bg-green-100 rounded-full">
                    <FileSpreadsheet className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Téléchargez votre fichier CSV</p>
                    <p className="mt-1 text-sm text-gray-600">Cliquez sur le bouton "Exporter", puis sélectionnez "CSV (Google Calendar)"</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 p-2 bg-indigo-100 rounded-full">
                    <Grid className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Accédez à Google Calendar</p>
                    <p className="mt-1 text-sm text-gray-600">Cliquez sur le menu des applications Google (carré) en haut à droite, puis sélectionnez "Agenda"</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 p-2 bg-yellow-100 rounded-full">
                    <Settings className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Ouvrez les paramètres</p>
                    <p className="mt-1 text-sm text-gray-600">Cliquez sur l'icône des paramètres (roue dentelée) puis sélectionnez "Paramètres"</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 p-2 bg-purple-100 rounded-full">
                    <Import className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Importez votre planning</p>
                    <ol className="mt-2 space-y-2 text-sm text-gray-600">
                      <li>1. Dans le menu de gauche, cliquez sur "Importer et exporter"</li>
                      <li>2. Sélectionnez le fichier CSV téléchargé</li>
                      <li>3. Choisissez votre agenda dans le menu déroulant</li>
                      <li>4. Cliquez sur "Importer"</li>
                    </ol>
                  </div>
                </li>
                <li className="flex items-start gap-4 p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex-shrink-0 p-2 bg-green-100 rounded-full">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-green-900">Terminé !</p>
                    <p className="mt-1 text-sm text-green-700">Un message de confirmation devrait apparaître. Votre planning est maintenant importé dans Google Calendar.</p>
                  </div>
                </li>
              </ol>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowImportHelp(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserPlanningPage;