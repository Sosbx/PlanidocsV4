import React, { useState, useEffect } from 'react';
import { X, HelpCircle, Columns, LayoutList } from 'lucide-react';

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
  important?: boolean; // Pour mettre en évidence les étapes cruciales
}

const tutorialSteps: TutorialStep[] = [
  {
    target: '[data-tutorial="tutorial-button"]',
    title: 'Guide Interactif',
    content: 'Bienvenue dans le tutoriel. Cliquez sur ce bouton orange à tout moment pour retrouver l\'aide. Suivez les étapes pour découvrir toutes les fonctionnalités de votre planning.',
    position: 'bottom',
    highlightTargets: ['[data-tutorial="tutorial-button"] button'],
    important: true,
    icon: <HelpCircle className="h-5 w-5 text-orange-600" />
  },
  {
    target: '[data-tutorial="toggle-desiderata"]',
    title: 'Afficher les Desiderata',
    content: 'Activez ce bouton pour voir vos desiderata superposés sur votre planning. Cela vous permet de comparer vos souhaits avec le planning final.',
    position: 'bottom',
    highlightTargets: ['[data-tutorial="toggle-desiderata"] button', '[data-tutorial="toggle-desiderata"] input[type="checkbox"]'],
    important: true,
    icon: <HelpCircle className="h-5 w-5 text-orange-600" />
  },
  {
    target: '[data-tutorial="view-switcher"]',
    title: 'Changer de Vue',
    content: 'Alternez entre deux modes : Vue en colonnes (défilement horizontal) et Vue en liste (défilement vertical). Choisissez celle qui convient le mieux à votre appareil.',
    position: 'bottom',
    highlightTargets: ['[data-tutorial="view-switcher"] button:first-child', '[data-tutorial="view-switcher"] button:last-child'],
    important: true,
    icon: <div className="flex gap-2"><Columns className="h-5 w-5 text-orange-600" /><LayoutList className="h-5 w-5 text-orange-600" /></div>
  },
  {
    target: '[data-tutorial="planning-grid"]',
    title: 'Interagir avec le Planning',
    content: 'Cliquez sur une garde pour la proposer à l\'échange ou la retirer. Vous pourrez également ajouter un commentaire pour préciser vos conditions d\'échange.',
    position: 'bottom',
    highlightTargets: ['[data-tutorial="planning-grid"]'],
    important: true,
    icon: <HelpCircle className="h-5 w-5 text-orange-600" />
  },
  {
    target: 'button[title="Exporter le planning"]',
    title: 'Exporter votre Planning',
    content: 'Cliquez sur "Exporter" pour télécharger votre planning. Vous pouvez choisir entre CSV (Google Calendar), ICS (Apple Calendar) ou PDF. L\'aide à l\'importation est disponible dans le menu déroulant.',
    position: 'bottom',
    highlightTargets: ['button[title="Exporter le planning"]'],
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
      // Nettoyer tous les éléments qui pourraient avoir des classes de surbrillance
      const allHighlightClasses = [
        ...HIGHLIGHT_CLASSES.standard, 
        ...HIGHLIGHT_CLASSES.button, 
        'scale-110', 'scale-105',
        'transition-all', 
        'duration-300', 
        'ease-in-out'
      ];
      
      // Cibler spécifiquement les éléments susceptibles d'avoir des highlights
      const selectorsToClean = [
        '[data-tutorial]',
        'button',
        'a',
        '.ring-4',
        '.ring-indigo-500',
        '.ring-amber-500',
        '.animate-pulse',
        '.scale-110',
        '.scale-105',
        '[data-tutorial="planning-grid"]',
        '[data-tutorial="planning-grid"] > *'
      ];
      
      selectorsToClean.forEach(selector => {
        try {
          document.querySelectorAll(selector).forEach(el => {
            allHighlightClasses.forEach(className => {
              el.classList.remove(className);
            });
          });
        } catch (e) {
          // Ignorer les erreurs de sélecteur
        }
      });
    };

    const positionTooltip = () => {
      const currentTarget = document.querySelector(tutorialSteps[currentStep].target);
      if (!currentTarget) return;

      // Nettoyer les highlights précédents
      cleanupHighlights();

      // Le nettoyage est déjà fait par cleanupHighlights()

      // Appliquer les nouveaux highlights avec délai pour éviter les problèmes de rendu
      setTimeout(() => {
        const currentStepData = tutorialSteps[currentStep];
        if (currentStepData.highlightTargets && currentStepData.highlightTargets.length > 0) {
          currentStepData.highlightTargets.forEach(target => {
            const elements = document.querySelectorAll(target);
            
            if (elements.length === 0) {
              console.warn(`Aucun élément trouvé pour le sélecteur: ${target}`);
              return;
            }
            
            // Limiter le nombre d'éléments à highlighter pour éviter les problèmes de performance
            const maxElements = 10;
            const elementsToHighlight = elements.length > maxElements ? 
              Array.from(elements).slice(0, maxElements) : 
              Array.from(elements);
            
            elementsToHighlight.forEach(el => {
              // Déterminer le type de highlight à appliquer
              const isButton = el.tagName === 'BUTTON' || el.tagName === 'A';
              const isLargeElement = el.tagName === 'DIV' || el.tagName === 'TABLE' || el.getAttribute('data-tutorial');
              
              if (isLargeElement) {
                // Pour les grands éléments, utiliser un highlight plus subtil sans animation
                el.classList.add('ring-4', 'ring-indigo-500', 'ring-opacity-90', 'z-[100]', 'shadow-xl');
              } else if (isButton) {
                // Pour les boutons, utiliser le highlight complet avec animation
                HIGHLIGHT_CLASSES.button.forEach(className => {
                  el.classList.add(className);
                });
                el.classList.add('scale-110');
              } else {
                // Pour les autres éléments, highlight standard sans animation excessive
                el.classList.add('ring-4', 'ring-amber-500', 'ring-opacity-90', 'z-[100]', 'shadow-xl');
              }
              
              // Ajouter la transition seulement si nécessaire
              if (!isLargeElement) {
                el.classList.add('transition-all', 'duration-300', 'ease-in-out');
              }
            });
          });
        }
      }, 100); // Délai pour s'assurer que le DOM est prêt

      // Mesures de base
      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;
      const isMobile = window.innerWidth < 640; // Breakpoint sm de Tailwind

      // Dimensions dynamiques basées sur la taille de l'écran
      const tooltipWidth = isMobile ? window.innerWidth * 0.92 : Math.min(448, window.innerWidth * 0.8); // max-w-md = 28rem = 448px
      const tooltipHeight = isMobile ? 280 : 250; // Estimation plus réaliste de la hauteur
      const margin = isMobile ? 8 : 16; // Marge plus petite sur mobile

      const rect = currentTarget.getBoundingClientRect();

      let top = 0;
      let left = 0;
      let origin = 'center';
      const position = tutorialSteps[currentStep].position;

      // Gestion spéciale pour l'étape planning qui nécessite un meilleur positionnement
      const isPlanningStep = tutorialSteps[currentStep].target === '[data-tutorial="planning-grid"]';
      const isTutorialButton = tutorialSteps[currentStep].target === '[data-tutorial="tutorial-button"]';

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

        // Calcul de la position horizontale en fonction de la position demandée
        if (position === 'left') {
          left = Math.max(margin, rect.left - tooltipWidth - margin);
          origin = 'right';
        } else if (position === 'right') {
          left = Math.min(windowWidth - tooltipWidth - margin, rect.right + margin);
          origin = 'left';
        } else {
          // Pour 'top' et 'bottom', centrer horizontalement
          left = rect.left + (rect.width / 2) - (tooltipWidth / 2);

          // Ajustement si le tooltip dépasse l'écran horizontalement
          if (left < margin) {
            left = margin;
            origin = 'left';
          } else if (left + tooltipWidth > windowWidth - margin) {
            left = windowWidth - tooltipWidth - margin;
            origin = 'right';
          }
        }

        // Calcul de la position verticale en fonction de la position demandée
        if (position === 'top') {
          top = Math.max(margin, rect.top - tooltipHeight - margin);
          origin = `${origin} bottom`;
        } else if (position === 'bottom') {
          top = Math.min(windowHeight - tooltipHeight - margin, rect.bottom + margin);
          origin = `${origin} top`;
        } else {
          // Pour 'left' et 'right', centrer verticalement
          top = rect.top + (rect.height / 2) - (tooltipHeight / 2);

          // Ajustement si le tooltip dépasse l'écran verticalement
          if (top < margin) {
            top = margin;
            origin = `top ${origin}`;
          } else if (top + tooltipHeight > windowHeight - margin) {
            top = windowHeight - tooltipHeight - margin;
            origin = `bottom ${origin}`;
          }
        }
      }

      // Sur mobile, toujours positionner les tooltips en dessous ou au-dessus pour ne pas cacher les boutons
      if (isMobile) {
        // Déterminer s'il y a plus d'espace en haut ou en bas
        const spaceAbove = rect.top;
        const spaceBelow = windowHeight - rect.bottom;
        
        if (spaceBelow > tooltipHeight + margin * 2 || spaceBelow > spaceAbove) {
          // Positionner en dessous si assez d'espace
          top = rect.bottom + margin * 2; // Ajouter plus d'espace pour éviter de cacher le bouton
          origin = 'top';
        } else {
          // Sinon positionner au-dessus
          top = Math.max(margin, rect.top - tooltipHeight - margin * 2);
          origin = 'bottom';
        }
        
        // Centrer horizontalement sur mobile
        left = windowWidth / 2 - tooltipWidth / 2;
      } else {
        // Sur desktop, suivre la position demandée mais avec des ajustements
        if (position === 'left' || position === 'right') {
          // Si l'espace est insuffisant sur les côtés, placer au-dessus ou en-dessous
          if (left < margin || left + tooltipWidth > windowWidth - margin) {
            if (rect.top > windowHeight / 2) {
              // Plus de place en haut
              top = Math.max(margin, rect.top - tooltipHeight - margin);
              left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
              origin = 'bottom';
            } else {
              // Plus de place en bas
              top = Math.min(windowHeight - tooltipHeight - margin, rect.bottom + margin);
              left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
              origin = 'top';
            }
          }
        }
      }

      // S'assurer que le tooltip reste dans les limites de l'écran
      top = Math.max(margin, Math.min(windowHeight - tooltipHeight - margin, top));
      left = Math.max(margin, Math.min(windowWidth - tooltipWidth - margin, left));

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