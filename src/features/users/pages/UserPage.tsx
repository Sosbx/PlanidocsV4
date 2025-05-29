// Pages Mes Désiderata
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar, Save, Download, HelpCircle, Clock, Columns, LayoutList } from 'lucide-react';
import FloatingControlBar from '../../../components/FloatingControlBar';
import { format } from 'date-fns';
import PlanningTable from '../../../components/PlanningTable';
import { usePlanningConfig } from '../../../context/planning/PlanningContext';
import { useAuth } from '../../../features/auth/hooks';
import { useDesiderata } from '../../../features/planning/hooks/useDesiderata';
import Toast from '../../../components/Toast';
import { getDesiderata } from '../../../lib/firebase/desiderata';
import { loadPdfExporter, loadCsvPlanningExporter } from '../../../utils/lazyExporters';
import Tutorial from '../../../components/Tutorial';
import { Selections, PeriodSelection } from '../../../types/planning';

const UserPage: React.FC = () => {
  const { config } = usePlanningConfig();
  const { user } = useAuth();
  const { validateDesiderata, isSaving } = useDesiderata();
  const [isValidated, setIsValidated] = useState(user?.hasValidatedPlanning || false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [validatedSelections, setValidatedSelections] = useState<Record<string, PeriodSelection>>({});
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });
  const [isDeadlineExpired, setIsDeadlineExpired] = useState(false);
  const [planningRef, setPlanningRef] = useState<{
    saveSelections: () => Promise<void>;
    activeDesiderata: 'primary' | 'secondary' | null;
    setActiveDesiderata: (type: 'primary' | 'secondary' | null) => void;
    primaryPercentage: number;
    secondaryPercentage: number;
    isSaving: boolean;
  } | null>(null);
  const [currentSelections, setCurrentSelections] = useState<Record<string, 'primary' | 'secondary' | null>>({});
  const [viewMode, setViewMode] = useState<'multiColumn' | 'singleColumn'>('multiColumn');
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const desiderataControlsRef = useRef<HTMLDivElement>(null);

  const handleResetComplete = useCallback(() => {
    setIsValidated(false);
    setCurrentSelections({});
  }, []);

  useEffect(() => {
    const loadSelections = async () => {
      if (user) {
        try {
          const desiderata = await getDesiderata(user.id);
          if (desiderata?.selections) {
            // Conversion explicite pour satisfaire le typage
            const simpleSelections = Object.entries(desiderata.selections).reduce((acc, [key, value]) => {
              // Si value est un objet avec une propriété type, prendre cette valeur
              if (typeof value === 'object' && value !== null && 'type' in value) {
                acc[key] = value.type;
              } else {
                // Sinon, considérer que value est déjà du bon type
                acc[key] = value as 'primary' | 'secondary' | null;
              }
              return acc;
            }, {} as Record<string, 'primary' | 'secondary' | null>);
            
            setCurrentSelections(simpleSelections);
            if (desiderata.validatedAt) {
              setValidatedSelections(desiderata.selections);
            }
          }
        } catch (error) {
          console.error('Error loading selections:', error);
        }
      }
    };
    loadSelections();
  }, [user]);

  // Mettre à jour l'état de validation quand l'utilisateur change
  useEffect(() => {
    if (user) {
      setIsValidated(user.hasValidatedPlanning);
    }
  }, [user?.hasValidatedPlanning]);

  // Configuration de l'Intersection Observer pour détecter la visibilité des contrôles
  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const setupObserver = () => {
      if (!desiderataControlsRef.current || !planningRef) {
        // Réessayer après un court délai si le ref n'est pas encore disponible
        timeoutId = setTimeout(setupObserver, 100);
        return;
      }

      observer = new IntersectionObserver(
        ([entry]) => {
          setIsControlsVisible(entry.isIntersecting);
        },
        { 
          threshold: 0, // Déclencher dès que les contrôles ne sont plus visibles du tout
          rootMargin: "-10px 0px 0px 0px" // Marge négative en haut pour déclencher un peu avant que les contrôles ne sortent complètement
        }
      );

      observer.observe(desiderataControlsRef.current);
    };

    setupObserver();

    // Cleanup
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (observer && desiderataControlsRef.current) {
        observer.unobserve(desiderataControlsRef.current);
      }
    };
  }, [planningRef]);

  useEffect(() => {
    const checkDeadline = () => {
      if (config.deadline) {
        setIsDeadlineExpired(new Date() > config.deadline);
      }
    };

    checkDeadline();
    const interval = setInterval(checkDeadline, 1000);
    return () => clearInterval(interval);
  }, [config.deadline]);

  // Effect pour détecter la taille de l'écran et définir le mode d'affichage automatiquement
  useEffect(() => {
    const checkScreenSize = () => {
      const isSmallScreen = window.innerWidth < 768; // md breakpoint
      setViewMode(isSmallScreen ? 'singleColumn' : 'multiColumn');
    };
    
    // Vérifier la taille initiale
    checkScreenSize();
    
    // Ajouter un listener pour les changements de taille d'écran
    window.addEventListener('resize', checkScreenSize);
    
    // Nettoyer le listener au démontage
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const getTimeRemaining = (deadline: Date | null | undefined) => {
    if (!deadline) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: true
      };
    }

    const now = new Date();
    const difference = deadline.getTime() - now.getTime();
    const isExpired = difference <= 0;

    if (isExpired) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: true
      };
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    return {
      days,
      hours,
      minutes,
      seconds,
      isExpired: false
    };
  };

  const handleValidate = async () => {
    if (!user || !planningRef) return;
    
    try {
      // Sauvegarder les sélections actuelles
      await planningRef.saveSelections();
      const currentDesiderata = await getDesiderata(user.id);
      const selections = currentDesiderata?.selections || {};
      
      // Valider le planning
      const success = await validateDesiderata(user.id);
      
      if (success) {
        setIsValidated(true);
        setValidatedSelections(selections);
        setToast({
          visible: true,
          message: 'Desiderata validés avec succès',
          type: 'success'
        });
      } else {
        setToast({
          visible: true,
          message: 'Erreur lors de la validation',
          type: 'error'
        });
      }
    } catch (error) {
      setToast({
        visible: true,
        message: 'Erreur lors de la validation',
        type: 'error'
      });
    }
  };

  const handleDownloadCSV = async () => {
    if (user) {
      setToast({
        visible: true,
        message: 'Préparation du fichier CSV...',
        type: 'success'
      });
      
      try {
        const exportPlanningToCSV = await loadCsvPlanningExporter();
        exportPlanningToCSV({
          userName: `${user.lastName}_${user.firstName}`,
          startDate: config.startDate,
          endDate: config.endDate,
          selections: validatedSelections,
          primaryLimit: config.primaryDesiderataLimit,
          secondaryLimit: config.secondaryDesiderataLimit,
          isDesiderata: true
        });
        
        setToast({
          visible: true,
          message: 'Fichier CSV généré avec succès',
          type: 'success'
        });
      } catch (error) {
        console.error('Erreur lors de l\'exportation CSV:', error);
        setToast({
          visible: true,
          message: 'Erreur lors de la génération du fichier CSV',
          type: 'error'
        });
      }
    }
  };

  const handleDownloadPDF = async () => {
    if (user) {
      setToast({
        visible: true,
        message: 'Préparation du fichier PDF...',
        type: 'success'
      });
      
      try {
        // Afficher les sélections validées pour débogage
        console.log("validatedSelections pour PDF:", validatedSelections);
        console.log("Nombre de sélections pour PDF:", Object.keys(validatedSelections).length);
        
        // Ne pas transformer les données - transmettre directement les validatedSelections
        // Cela permettra de conserver la structure avec les commentaires
        
        // Afficher les données pour débogage
        console.log("Données envoyées pour PDF:", validatedSelections);
        console.log("Nombre de sélections pour PDF:", Object.keys(validatedSelections).length);
        
        const exportPlanningToPDF = await loadPdfExporter();
        
        // Nous gardons validatedSelections tel quel pour conserver les commentaires
        // et pour que l'exportateur PDF puisse les récupérer
        
        exportPlanningToPDF({
          userName: `${user.lastName}_${user.firstName}`,
          startDate: config.startDate,
          endDate: config.endDate,
          assignments: {}, // Pas d'assignments pour les desiderata
          desiderata: validatedSelections as any, // conversion de type pour éviter l'erreur TS
          primaryLimit: config.primaryDesiderataLimit,
          secondaryLimit: config.secondaryDesiderataLimit,
          showAssignmentsOnly: false,
          showComments: true
        });
        
        setToast({
          visible: true,
          message: 'Fichier PDF généré avec succès',
          type: 'success'
        });
      } catch (error) {
        console.error('Erreur lors de l\'exportation PDF:', error);
        setToast({
          visible: true,
          message: 'Erreur lors de la génération du fichier PDF',
          type: 'error'
        });
      }
    }
  };

  if (!user?.roles.isUser) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-yellow-50 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">Accès non autorisé</h2>
          <p className="text-yellow-700">
            En tant qu'administrateur uniquement, vous n'avez pas accès aux desiderata.
            Seuls les utilisateurs peuvent remplir leurs desiderata.
          </p>
        </div>
      </div>
    );
  }

  if (!config.isConfigured) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-yellow-50 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">Desiderata non configurés</h2>
          <p className="text-yellow-700">
            Veuillez attendre que l'administrateur configure les desiderata.
          </p>
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600 mr-2" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Mes Desiderata</h1>
          </div>
          
          <div className="flex items-center gap-1 border rounded-md bg-white shadow-sm" data-tutorial="view-switcher">
            <button
              onClick={() => setViewMode('multiColumn')}
              className={`p-1.5 rounded-l-md transition-colors ${viewMode === 'multiColumn' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
              title="Vue en colonnes"
            >
              <Columns className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('singleColumn')}
              className={`p-1.5 rounded-r-md transition-colors ${viewMode === 'singleColumn' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
              title="Vue en liste"
            >
              <LayoutList className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Compte à rebours */}
        <div className="mb-4 text-xs">
          {!getTimeRemaining(config.deadline).isExpired ? (
            <div className="flex flex-row items-center justify-between text-blue-700 bg-blue-50 px-3 py-1.5 rounded-md">
              <div className="flex items-center gap-1 sm:gap-2">
                <Clock className="h-4 w-4" />
                <span>Temps restant</span>
                <div className="flex items-center gap-1 text-blue-900 font-medium">
                  <span>
                    {getTimeRemaining(config.deadline).days > 0 ? `${getTimeRemaining(config.deadline).days}j ` : ''}
                    {String(getTimeRemaining(config.deadline).hours).padStart(2, '0')}h
                    {String(getTimeRemaining(config.deadline).minutes).padStart(2, '0')}m
                  </span>
                </div>
              </div>
              <div className="text-[10px] text-gray-500 italic">
                MàJ : {new Date().toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-row items-center justify-between text-red-700 bg-red-50 px-3 py-1.5 rounded-md">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>Le délai de réponse est expiré</span>
              </div>
            </div>
          )}
        </div>


        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center mb-4 sm:mb-0">
            {/* Bouton d'aide - affiché à gauche sur grand écran */}
            <div className="hidden sm:block">
              <button
                onClick={() => setShowTutorial(true)}
                className="px-3 py-1 rounded-md bg-amber-50 hover:bg-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-200 transition-all text-amber-700 text-sm"
                title="Tutoriel"
                data-tutorial="tutorial-button"
                data-component-name="UserPage"
              >
                <div className="flex items-center gap-1">
                  <span>Aide</span>
                  <HelpCircle className="h-3.5 w-3.5 text-amber-500" />
                </div>
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {/* Bouton d'aide - affiché au-dessus du bouton valider sur petit écran */}
            <div className="w-full sm:hidden mb-2">
              <button
                onClick={() => setShowTutorial(true)}
                className="w-full px-3 py-1 rounded-md bg-amber-50 hover:bg-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-200 transition-all text-amber-700 text-sm"
                title="Tutoriel"
                data-tutorial="tutorial-button"
                data-component-name="UserPage"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Aide</span>
                  <HelpCircle className="h-3.5 w-3.5 text-amber-500" />
                </div>
              </button>
            </div>
            <button 
              onClick={handleValidate}
              data-tutorial="validate-button"
              disabled={isDeadlineExpired || isSaving}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white flex-1 sm:flex-none justify-center ${
                isValidated ? 'bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed`}
              title={isValidated ? "Mettre à jour les desiderata" : "Valider et envoyer les desiderata (modifiable jusqu'à la date limite)"}
            >
              <Save className="h-4 w-4 sm:mr-2" />
              <span className="inline">
                {isSaving ? 'Validation...' : isValidated ? 'Mettre à jour' : 'Valider'}
              </span>
            </button>
            <div className="flex gap-2 flex-1 sm:flex-none">
              <button
                onClick={handleDownloadPDF}
                disabled={!isValidated}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none justify-center"
                title="Télécharger en PDF"
              >
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="inline">PDF</span>
              </button>
              <button
                onClick={handleDownloadCSV}
                disabled={!isValidated}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none justify-center"
                title="Télécharger en CSV"
              >
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="inline">CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Barre de contrôle flottante qui apparaît lorsque les contrôles originaux ne sont plus visibles */}
        {planningRef && (
          <FloatingControlBar
            activeDesiderata={planningRef.activeDesiderata}
            setActiveDesiderata={planningRef.setActiveDesiderata}
            primaryPercentage={planningRef.primaryPercentage}
            secondaryPercentage={planningRef.secondaryPercentage}
            primaryLimit={config.primaryDesiderataLimit}
            secondaryLimit={config.secondaryDesiderataLimit}
            isDeadlineExpired={isDeadlineExpired}
            isSaving={isSaving}
            isValidated={isValidated}
            onValidate={handleValidate}
            isVisible={!isControlsVisible}
          />
        )}

        <div data-tutorial="planning-grid">
          <PlanningTable 
            ref={setPlanningRef}
            onResetComplete={handleResetComplete}
            startDate={config.startDate} 
            endDate={config.endDate}
            primaryLimit={config.primaryDesiderataLimit}
            secondaryLimit={config.secondaryDesiderataLimit}
            isDeadlineExpired={isDeadlineExpired}
            viewMode={viewMode}
            desiderataControlsRef={desiderataControlsRef}
          />
        </div>

        <Tutorial isOpen={showTutorial} onClose={() => setShowTutorial(false)} />
      </div>
    </div>
  );
};

export default UserPage;
