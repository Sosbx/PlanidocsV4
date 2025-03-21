import React, { useState, useEffect } from 'react';
import { X, HelpCircle } from 'lucide-react';

const HIGHLIGHT_CLASS = 'ring-4 ring-indigo-500 ring-opacity-50 z-50';

interface TutorialStep {
  target: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  highlightTargets?: string[];
}

const tutorialSteps: TutorialStep[] = [
  {
    target: '[data-tutorial="toggle-desiderata"]',
    title: 'Afficher les Desiderata',
    content: 'Activez ce bouton pour voir vos desiderata superposés sur votre planning. Cela vous permet de comparer vos souhaits avec le planning final.',
    position: 'bottom',
    highlightTargets: ['[data-tutorial="toggle-desiderata"]']
  },
  {
    target: '[data-tutorial="planning-grid"]',
    title: 'Comprendre le Planning',
    content: 'Pour proposer une garde à la bourse aux gardes (BaG), cliquez sur la garde puis sur BaG, faite de même pour la retirer. Vous pouvez également laisser un commentaire si besoin.',
    position: 'top',
    highlightTargets: ['[data-tutorial="planning-grid"]']
  },
  {
    target: '[data-tutorial="planning-grid"]',
    title: 'Bourse aux Gardes (BaG)',
    content: 'Les gardes que vous avez proposées à la bourse apparaissent en jaune. Les gardes que vous avez reçues via la bourse apparaissent en vert.',
    position: 'top',
    highlightTargets: ['[data-tutorial="planning-grid"]']
  },
  {
    target: '[data-tutorial="export-calendar"]',
    title: 'Export Google Calendar',
    content: 'Téléchargez votre planning au format CSV compatible avec Google Calendar pour l\'importer facilement dans votre agenda.',
    position: 'bottom',
    highlightTargets: ['[data-tutorial="export-calendar"]']
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

      const rect = currentTarget.getBoundingClientRect();
      const tooltipWidth = 448; // max-w-md = 28rem = 448px
      const tooltipHeight = 200; // hauteur approximative
      const margin = 12; // marge entre le tooltip et l'élément
      
      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;
      
      let top = 0;
      let left = 0;
      let origin = 'center';

      // Calcul de la position horizontale
      left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
      
      // Ajustement si le tooltip dépasse l'écran horizontalement
      if (left < margin) {
        left = margin;
        origin = 'left';
      } else if (left + tooltipWidth > windowWidth - margin) {
        left = windowWidth - tooltipWidth - margin;
        origin = 'right';
      }

      // Calcul de la position verticale
      if (rect.top > tooltipHeight + margin) {
        // Afficher au-dessus si assez d'espace
        top = rect.top - tooltipHeight - margin;
      } else {
        // Sinon afficher en-dessous
        top = rect.bottom + margin;
      }

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
        className="fixed z-50 w-full max-w-md bg-white rounded-lg shadow-xl transform transition-all duration-200 ease-in-out"
        style={{
          top: `${tooltipStyle.top}px`,
          left: `${tooltipStyle.left}px`,
          transformOrigin: tooltipStyle.transformOrigin
        }}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {tutorialSteps[currentStep].title}
            </h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-gray-600 mb-4">
            {tutorialSteps[currentStep].content}
          </p>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              Étape {currentStep + 1} sur {tutorialSteps.length}
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
                className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
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