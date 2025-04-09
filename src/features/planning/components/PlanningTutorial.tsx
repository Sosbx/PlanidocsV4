import React, { useState, useEffect } from 'react';
import { X, HelpCircle, Columns, LayoutList } from 'lucide-react';

const HIGHLIGHT_CLASS = 'ring-4 ring-indigo-500 ring-opacity-70 z-50 shadow-lg animate-pulse';

interface TutorialStep {
  target: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  highlightTargets?: string[];
  icon?: React.ReactNode;
}

const tutorialSteps: TutorialStep[] = [
  {
    target: '[data-tutorial="tutorial-button"]',
    title: 'Guide Interactif',
    content: 'Bienvenue dans le tutoriel. Cliquez sur ce bouton orange à tout moment pour retrouver l\'aide. Suivez les étapes pour découvrir toutes les fonctionnalités de votre planning.',
    position: 'bottom',
    highlightTargets: ['[data-tutorial="tutorial-button"]'],
    icon: <HelpCircle className="h-5 w-5 text-orange-600" />
  },
  {
    target: '[data-tutorial="toggle-desiderata"]',
    title: 'Afficher les Desiderata',
    content: 'Activez ce bouton pour voir vos desiderata superposés sur votre planning. Cela vous permet de comparer vos souhaits avec le planning final.',
    position: 'bottom',
    highlightTargets: ['[data-tutorial="toggle-desiderata"]'],
    icon: <HelpCircle className="h-5 w-5 text-orange-600" />
  },
  {
    target: '[data-tutorial="view-switcher"]',
    title: 'Changer de Vue',
    content: 'Alternez entre deux modes : Vue en colonnes (défilement horizontal) et Vue en liste (défilement vertical). Choisissez celle qui convient le mieux à votre appareil.',
    position: 'bottom',
    highlightTargets: ['[data-tutorial="view-switcher"]'],
    icon: <div className="flex gap-2"><Columns className="h-5 w-5 text-orange-600" /><LayoutList className="h-5 w-5 text-orange-600" /></div>
  },
  {
    target: '[data-tutorial="planning-grid"]',
    title: 'Interagir avec le Planning',
    content: 'Cliquez sur une garde pour la proposer à l\'échange ou la retirer. Vous pourrez également ajouter un commentaire pour préciser vos conditions d\'échange.',
    position: 'top',
    highlightTargets: ['[data-tutorial="planning-grid"] table', '[data-tutorial="planning-grid"] table tbody'],
    icon: <HelpCircle className="h-5 w-5 text-orange-600" />
  },
  {
    target: '[data-tutorial="planning-grid"]',
    title: 'Codes Couleur',
    content: '🟡 Jaune : vos gardes proposées à l\'échange\n🟢 Vert : gardes reçues suite à un échange\n🔴 Rouge : vos desiderata primaires\n🔵 Bleu : vos desiderata secondaires\n⚪ Gris : weekends/jours fériés',
    position: 'top',
    highlightTargets: ['[data-tutorial="planning-grid"]'],
    icon: <HelpCircle className="h-5 w-5 text-indigo-500" />
  },
  {
    target: '[data-tutorial="planning-grid"]',
    title: 'Exporter votre Planning',
    content: 'Cliquez sur "Exporter" pour télécharger votre planning. Vous pouvez choisir entre CSV (Google Calendar), ICS (Apple Calendar) ou PDF. L\'aide à l\'importation est disponible dans le menu déroulant.',
    position: 'bottom',
    highlightTargets: ['[data-tutorial="planning-grid"]'],
    icon: <HelpCircle className="h-5 w-5 text-orange-600" />
  }
];

interface TutorialProps {
  isOpen: boolean;
  onClose: () => void;
}

const PlanningTutorial: React.FC<TutorialProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipStyle, setTooltipStyle] = useState({
    top: 0,
    left: 0,
    transformOrigin: 'center'
  });

  useEffect(() => {
    if (!isOpen) return;

    // Fonction pour nettoyer les highlights
    const cleanupHighlights = () => {
      document.querySelectorAll(`.${HIGHLIGHT_CLASS.split(' ').join('.')}`).forEach(el => {
        HIGHLIGHT_CLASS.split(' ').forEach(className => {
          el.classList.remove(className);
        });
      });
    };

    const positionTooltip = () => {
      const currentTarget = document.querySelector(tutorialSteps[currentStep].target);
      if (!currentTarget) return;

      // Nettoyer les highlights précédents
      cleanupHighlights();

      // Appliquer les nouveaux highlights
      const currentStepData = tutorialSteps[currentStep];
      if (currentStepData.highlightTargets) {
        currentStepData.highlightTargets.forEach(target => {
          const elements = document.querySelectorAll(target);
          elements.forEach(el => {
            HIGHLIGHT_CLASS.split(' ').forEach(className => {
              el.classList.add(className);
            });
          });
        });
      }

      // Mesures de base
      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;
      const isMobile = windowWidth < 640;
      const isTablet = windowWidth >= 640 && windowWidth < 768;
      
      // Calculer la taille de la bulle en fonction de la taille d'écran
      const tooltipWidth = isMobile ? Math.min(windowWidth * 0.92, 400) : isTablet ? 400 : 448;
      const tooltipHeight = isMobile ? 240 : 220;
      const margin = isMobile ? 12 : 16;
      
      // Obtenir la position de l'élément ciblé
      const rect = currentTarget.getBoundingClientRect();
      
      let top = 0;
      let left = 0;
      let origin = 'center';

      // Gestion spéciale pour l'étape planning qui nécessite un meilleur positionnement
      const isPlanningStep = currentStepData.target === '[data-tutorial="planning-grid"]';
      const isTutorialButton = currentStepData.target === '[data-tutorial="tutorial-button"]';

      if (isMobile) {
        // Sur mobile, positionner au centre horizontalement
        left = (windowWidth - tooltipWidth) / 2;
        
        // Ajuster horizontalement si nécessaire
        left = Math.max(margin, Math.min(windowWidth - tooltipWidth - margin, left));
        
        // Positionnement vertical intelligent selon l'étape
        if (isPlanningStep) {
          // Pour le planning, positionner en haut
          top = margin + 10;
        } else if (isTutorialButton) {
          // Pour le bouton tutoriel, positionner juste en-dessous du titre
          top = rect.bottom + 10;
        } else {
          // Par défaut, center avec déplacement vers le haut pour mieux voir
          top = Math.max(windowHeight * 0.3, rect.bottom + margin);
        }
      } else {
        // Sur tablette/desktop, positionnement plus précis
        
        // Calcul horizontal centré sur l'élément cible
        left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
        
        // Ajustement horizontal pour rester dans l'écran
        left = Math.max(margin, Math.min(windowWidth - tooltipWidth - margin, left));
        
        // Orientation automatique en fonction de l'espace disponible
        if (isPlanningStep) {
          // Pour la grille de planning, toujours en haut avec espace
          top = margin + 10;
          origin = 'top';
        } else if (rect.top > tooltipHeight + margin + 40) {
          // Si assez d'espace au-dessus, placer au-dessus
          top = rect.top - tooltipHeight - margin;
          origin = 'bottom';
        } else if (rect.bottom + tooltipHeight + margin < windowHeight) {
          // Si assez d'espace en-dessous, placer en-dessous
          top = rect.bottom + margin;
          origin = 'top';
        } else {
          // Sinon, centrer verticalement dans la fenêtre
          top = (windowHeight - tooltipHeight) / 2;
          origin = 'center';
        }
      }

      // Assurer que la bulle est toujours entièrement visible (sécurité finale)
      top = Math.max(margin, Math.min(windowHeight - tooltipHeight - margin, top));

      setTooltipStyle({
        top,
        left,
        transformOrigin: origin
      });
    };

    positionTooltip();
    window.addEventListener('resize', positionTooltip);
    window.addEventListener('scroll', positionTooltip);

    return () => {
      window.removeEventListener('resize', positionTooltip);
      window.removeEventListener('scroll', positionTooltip);
      cleanupHighlights();
    };
  }, [currentStep, isOpen]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleClose = () => {
    setCurrentStep(0);
    onClose();
  };

  return (
    <>
      {/* Overlay semi-transparent */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={handleClose} />

      {/* Tooltip */}
      <div
        className="fixed z-50 w-[92%] sm:w-auto sm:max-w-md bg-white rounded-lg shadow-xl transform transition-all duration-300 ease-in-out opacity-0 animate-fadeIn"
        style={{
          top: `${tooltipStyle.top}px`,
          left: `${tooltipStyle.left}px`,
          transformOrigin: tooltipStyle.transformOrigin,
          animation: 'fadeIn 0.3s forwards'
        }}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {tutorialSteps[currentStep].icon && (
                <div className="p-2 bg-amber-50/90 rounded-full flex-shrink-0 shadow-sm">
                  {tutorialSteps[currentStep].icon}
                </div>
              )}
              <h3 className="text-lg font-semibold text-gray-900">
                {tutorialSteps[currentStep].title}
              </h3>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="bg-gray-50 p-3 rounded-md mb-4 text-xs sm:text-sm text-gray-600 leading-relaxed">
            {tutorialSteps[currentStep].content}
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              <span className="font-medium text-indigo-600">{currentStep + 1}</span>
              <span className="text-gray-400">/</span>
              <span>{tutorialSteps.length}</span>
            </div>
            <div className="flex gap-2">
              {currentStep > 0 && (
                <button
                  onClick={handlePrevious}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Précédent
                </button>
              )}
              <button
                onClick={handleNext}
                className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:outline-none"
              >
                {currentStep === tutorialSteps.length - 1 ? 'Terminer' : 'Suivant'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PlanningTutorial;