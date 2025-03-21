import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Save, Download, HelpCircle } from 'lucide-react';
import PlanningTable from '../components/PlanningTable';
import { usePlanningConfig } from '../context/PlanningContext';
import ConfigurationDisplay from '../components/ConfigurationDisplay';
import Countdown from '../components/Countdown';
import { useAuth } from '../hooks/useAuth';
import { useDesiderata } from '../hooks/useDesiderata';
import Toast from '../components/Toast';
import { getDesiderata } from '../lib/firebase/desiderata';
import { exportPlanningToPDF } from '../utils/pdfExport';
import { exportPlanningToCSV } from '../utils/csvExport';
import Tutorial from '../components/Tutorial';

const UserPage: React.FC = () => {
  const { config } = usePlanningConfig();
  const { user } = useAuth();
  const { validateDesiderata, isSaving } = useDesiderata();
  const [isValidated, setIsValidated] = useState(user?.hasValidatedPlanning || false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [validatedSelections, setValidatedSelections] = useState<Record<string, 'primary' | 'secondary' | null>>({});
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });
  const [isDeadlineExpired, setIsDeadlineExpired] = useState(false);
  const [planningRef, setPlanningRef] = useState<{ saveSelections: () => Promise<void> } | null>(null);
  const [currentSelections, setCurrentSelections] = useState<Record<string, 'primary' | 'secondary' | null>>({});

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
            setCurrentSelections(desiderata.selections);
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

  const handleDownloadCSV = () => {
    if (user) {
      exportPlanningToCSV({
        userName: `${user.lastName}_${user.firstName}`,
        startDate: config.startDate,
        endDate: config.endDate,
        selections: validatedSelections,
        primaryLimit: config.primaryDesiderataLimit,
        secondaryLimit: config.secondaryDesiderataLimit,
        isDesiderata: true
      });
    }
  };

  const handleDownloadPDF = () => {
    if (user) {
      exportPlanningToPDF({
        userName: `${user.lastName}_${user.firstName}`,
        startDate: config.startDate,
        endDate: config.endDate,
        selections: validatedSelections,
        primaryLimit: config.primaryDesiderataLimit,
        secondaryLimit: config.secondaryDesiderataLimit,
        isDesiderata: true
      });
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

      <div className="flex flex-col md:flex-row gap-4 mb-8 items-start">
        <ConfigurationDisplay config={config} className="flex-[3]" />
        <Countdown deadline={config.deadline} />
      </div>
      
      <div className="mb-8">
        <button
          onClick={() => setShowTutorial(true)}
          className="group mx-auto inline-flex items-center justify-center px-6 py-4 border-2 border-orange-300 rounded-lg shadow-md text-base font-medium text-orange-800 bg-gradient-to-b from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 hover:border-orange-400 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transform hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
        >
          <HelpCircle className="h-6 w-6 mr-3 text-orange-500 group-hover:text-orange-600 group-hover:rotate-12 transition-all duration-200" />
          <div className="flex flex-col items-start sm:flex-row sm:items-center">
            <span className="font-bold text-lg mr-2 text-orange-700">TUTORIEL</span>
            <span className="text-orange-600">Cliquez ici pour comprendre le fonctionnement du tableau</span>
          </div>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center mb-4 sm:mb-0">
            <Calendar className="h-6 w-6 text-indigo-600 mr-2" />
            <h2 className="text-xl font-semibold">Desiderata</h2>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button 
              onClick={handleValidate}
              data-tutorial="validate-button"
              disabled={isDeadlineExpired || isSaving}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white flex-1 sm:flex-none justify-center ${
                isValidated ? 'bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed`}
              title="Valider et envoyer les desiderata (modifiable jusqu'à la date limite)"
            >
              <Save className="h-4 w-4 sm:mr-2" />
              <span className="inline">
                {isSaving ? 'Validation...' : 'Valider'}
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

        <div data-tutorial="planning-grid">
        <PlanningTable 
          ref={setPlanningRef}
          onResetComplete={handleResetComplete}
          startDate={config.startDate} 
          endDate={config.endDate}
          primaryLimit={config.primaryDesiderataLimit}
          secondaryLimit={config.secondaryDesiderataLimit}
          isDeadlineExpired={isDeadlineExpired}
        />
        </div>

        <Tutorial isOpen={showTutorial} onClose={() => setShowTutorial(false)} />
      </div>
    </div>
  );
};

export default UserPage;