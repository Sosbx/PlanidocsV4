import React, { useState, useEffect } from 'react';
import { X, HelpCircle, Calendar, Filter, Clock, Users, Eye, List } from 'lucide-react';

// Classes CSS pour la mise en surbrillance des éléments
const HIGHLIGHT_CLASSES = {
  standard: ['ring-4', 'ring-indigo-500', 'ring-opacity-90', 'z-[100]', 'shadow-xl', 'animate-pulse'],
  button: ['ring-4', 'ring-amber-500', 'ring-opacity-100', 'z-[100]', 'shadow-xl', 'animate-pulse', 'scale-105']
};

interface TutorialStep {
  target: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  highlightTargets?: string[];
  icon?: React.ReactNode;
  important?: boolean;
  phaseSpecific?: ('submission' | 'distribution' | 'completed')[];
}

const tutorialSteps: TutorialStep[] = [
  {
    target: '[data-tutorial="phase-indicator"]',
    title: 'Les 3 phases de la Bourse',
    content: 'La bourse fonctionne en 3 phases :\n🔄 Phase d\'échange : Les médecins proposent leurs gardes depuis la page Mon planning et manifestent leur intérêt ici\n⚙️ Répartition en cours : L\'administrateur répartit manuellement les gardes\n✅ Terminée : Les échanges sont finalisés et appliqués',
    position: 'bottom',
    highlightTargets: ['[data-tutorial="phase-indicator"]'],
    important: true,
    icon: <Clock className="h-5 w-5 text-indigo-600" />
  },
  {
    target: '[data-tutorial="permanent-planning"]',
    title: 'Le Planning Flottant',
    content: 'Ce planning flottant affiche vos gardes personnelles en temps réel.\nIl reste visible pendant que vous parcourez les gardes disponibles.\nDeux modes : Vue mensuelle ou Vue 5 jours.\nLe bouton "+" vous permet d\'ouvrir votre planning en plus grand.\nLes pastilles colorées indiquent vos intérêts et conflits.',
    position: 'left',
    highlightTargets: ['[data-tutorial="permanent-planning"]'],
    important: true,
    icon: <Eye className="h-5 w-5 text-indigo-600" />
  },
  {
    target: '.inline-flex.items-center.gap-2',
    title: 'Changer de vue : Liste ou Calendrier',
    content: 'Bouton Liste : Affiche toutes les gardes disponibles dans une liste détaillée.\nBouton Calendrier : Visualise les gardes dans une vue mensuelle interactive.\nChoisissez la vue qui vous convient le mieux selon vos préférences.',
    position: 'bottom',
    highlightTargets: ['.inline-flex.items-center.gap-2 button'],
    icon: <div className="flex gap-2"><List className="h-5 w-5 text-indigo-600" /><Calendar className="h-5 w-5 text-indigo-600" /></div>
  },
  {
    target: '[data-tutorial="shift-exchange-calendar"]',
    title: 'Manifester votre intérêt',
    content: 'Cliquez sur une garde proposée pour manifester votre intérêt.\nUn indicateur vert confirme votre intérêt.\nUn indicateur rouge signale un conflit avec vos gardes.\nCliquez à nouveau pour retirer votre intérêt.',
    position: 'top',
    highlightTargets: ['[data-tutorial="shift-exchange-calendar"]'],
    important: true,
    icon: <Users className="h-5 w-5 text-green-600" />,
    phaseSpecific: ['submission']
  },
  {
    target: '[data-tutorial="filter-buttons"]',
    title: 'Filtres et options d\'affichage',
    content: 'Mes gardes : Visualisez uniquement vos gardes proposées\nMes intérêts : Affichez seulement les gardes qui vous intéressent\nDésiderata : Superposez vos préférences sur le calendrier\nFiltre par période : Isolez les gardes M, AM ou S',
    position: 'bottom',
    highlightTargets: ['[data-tutorial="filter-buttons"] button'],
    icon: <Filter className="h-5 w-5 text-indigo-600" />
  }
];

interface TutorialProps {
  isOpen: boolean;
  onClose: () => void;
  currentPhase?: 'submission' | 'distribution' | 'completed';
}

const ShiftExchangeTutorial: React.FC<TutorialProps> = ({ isOpen, onClose, currentPhase = 'submission' }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipStyle, setTooltipStyle] = useState({
    top: 0,
    left: 0,
    transformOrigin: 'center'
  });

  // Filtrer les étapes selon la phase actuelle - mémorisé pour éviter les recalculs
  const filteredSteps = React.useMemo(() => 
    tutorialSteps.filter(step => 
      !step.phaseSpecific || step.phaseSpecific.includes(currentPhase)
    ),
    [currentPhase]
  );

  useEffect(() => {
    if (!isOpen) return;

    // Fonction pour nettoyer les highlights
    const cleanupHighlights = () => {
      document.querySelectorAll('.ring-indigo-500, .ring-amber-500, .animate-pulse').forEach(el => {
        [...HIGHLIGHT_CLASSES.standard, ...HIGHLIGHT_CLASSES.button, 'scale-110', 'transition-all', 'duration-300', 'ease-in-out'].forEach(className => {
          el.classList.remove(className);
        });
      });
    };

    const positionTooltip = () => {
      // Vérifier que l'étape existe
      if (!filteredSteps[currentStep]) return;
      
      const currentTarget = document.querySelector(filteredSteps[currentStep].target);
      if (!currentTarget) return;

      // Nettoyer les highlights précédents
      cleanupHighlights();

      // Appliquer les nouveaux highlights avec délai
      setTimeout(() => {
        const currentStepData = filteredSteps[currentStep];
        if (currentStepData && currentStepData.highlightTargets) {
          currentStepData.highlightTargets.forEach(target => {
            const elements = document.querySelectorAll(target);
            
            elements.forEach(el => {
              HIGHLIGHT_CLASSES.button.forEach(className => {
                el.classList.add(className);
              });
              
              el.classList.add('transition-all', 'duration-300', 'ease-in-out');
              
              if (el.tagName === 'BUTTON' || el.tagName === 'A') {
                el.classList.add('scale-110');
              }
            });
          });
        }
      }, 100);

      // Calcul du positionnement
      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;
      const isMobile = window.innerWidth < 640;

      const tooltipWidth = isMobile ? window.innerWidth * 0.92 : Math.min(448, window.innerWidth * 0.8);
      const tooltipHeight = isMobile ? 320 : 280;
      const margin = isMobile ? 8 : 16;

      const rect = currentTarget.getBoundingClientRect();

      let top = 0;
      let left = 0;
      let origin = 'center';
      const position = filteredSteps[currentStep].position;

      if (isMobile) {
        // Sur mobile, centrer horizontalement
        left = (windowWidth - tooltipWidth) / 2;
        left = Math.max(margin, Math.min(windowWidth - tooltipWidth - margin, left));

        // Déterminer la meilleure position verticale
        const spaceAbove = rect.top;
        const spaceBelow = windowHeight - rect.bottom;
        
        if (spaceBelow > tooltipHeight + margin * 2 || spaceBelow > spaceAbove) {
          top = rect.bottom + margin * 2;
          origin = 'top';
        } else {
          top = Math.max(margin, rect.top - tooltipHeight - margin * 2);
          origin = 'bottom';
        }
      } else {
        // Sur desktop, suivre la position demandée
        if (position === 'left') {
          left = Math.max(margin, rect.left - tooltipWidth - margin);
          origin = 'right';
        } else if (position === 'right') {
          left = Math.min(windowWidth - tooltipWidth - margin, rect.right + margin);
          origin = 'left';
        } else {
          left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
          
          if (left < margin) {
            left = margin;
            origin = 'left';
          } else if (left + tooltipWidth > windowWidth - margin) {
            left = windowWidth - tooltipWidth - margin;
            origin = 'right';
          }
        }

        if (position === 'top') {
          top = Math.max(margin, rect.top - tooltipHeight - margin);
          origin = `${origin} bottom`;
        } else if (position === 'bottom') {
          top = Math.min(windowHeight - tooltipHeight - margin, rect.bottom + margin);
          origin = `${origin} top`;
        } else {
          top = rect.top + (rect.height / 2) - (tooltipHeight / 2);
          
          if (top < margin) {
            top = margin;
            origin = `top ${origin}`;
          } else if (top + tooltipHeight > windowHeight - margin) {
            top = windowHeight - tooltipHeight - margin;
            origin = `bottom ${origin}`;
          }
        }
      }

      // S'assurer que le tooltip reste dans les limites
      top = Math.max(margin, Math.min(windowHeight - tooltipHeight - margin, top));
      left = Math.max(margin, Math.min(windowWidth - tooltipWidth - margin, left));

      setTooltipStyle(prev => {
        // Ne mettre à jour que si les valeurs ont changé
        if (prev.top !== top || prev.left !== left || prev.transformOrigin !== origin) {
          return {
            top,
            left,
            transformOrigin: origin
          };
        }
        return prev;
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
  }, [currentStep, isOpen, filteredSteps]);

  // S'assurer que currentStep ne dépasse pas les limites après un changement de phase
  useEffect(() => {
    if (currentStep >= filteredSteps.length) {
      setCurrentStep(0);
    }
  }, [currentStep, filteredSteps.length]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStep < filteredSteps.length - 1) {
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
        className="fixed z-50 w-[92%] sm:w-auto sm:max-w-md bg-white rounded-lg shadow-xl transform transition-all duration-300 ease-in-out opacity-0 animate-fadeIn overflow-hidden"
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
              {filteredSteps[currentStep].icon && (
                <div className="p-2 bg-amber-50/90 rounded-full flex-shrink-0 shadow-sm">
                  {filteredSteps[currentStep].icon}
                </div>
              )}
              <h3 className="text-lg font-semibold text-gray-900">
                {filteredSteps[currentStep].title}
              </h3>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="bg-gray-50 p-3 rounded-md mb-4 text-xs sm:text-sm text-gray-600 leading-relaxed whitespace-pre-line">
            {filteredSteps[currentStep].content}
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              <span className="font-medium text-indigo-600">{currentStep + 1}</span>
              <span className="text-gray-400">/</span>
              <span>{filteredSteps.length}</span>
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
                {currentStep === filteredSteps.length - 1 ? 'Terminer' : 'Suivant'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ShiftExchangeTutorial;