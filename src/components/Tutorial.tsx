import React, { useState, useEffect, useCallback } from 'react';
import { X, HelpCircle, Calendar, Clock, CheckCircle } from 'lucide-react';

// Classes CSS pour la mise en surbrillance des éléments
const HIGHLIGHT_CLASSES = {
  standard: ['ring-4', 'ring-indigo-500', 'ring-opacity-90', 'z-[100]', 'shadow-xl', 'animate-pulse'],
  button: ['ring-4', 'ring-amber-500', 'ring-opacity-100', 'z-[100]', 'shadow-xl', 'animate-pulse', 'scale-105']
};

// Durée d'animation plus lente pour une meilleure lisibilité
const ANIMATION_DURATION = '0.5s';

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
    target: '[data-tutorial="desiderata-primary"]',
    title: 'Desiderata Prioritaires',
    content: 'Ce bouton rouge vous permet de sélectionner vos desiderata prioritaires.\n\nCe sont les indisponibilités que vous souhaitez absolument obtenir dans le planning. Utilisez-les pour les dates vraiment importantes pour vous.\n\nAprès avoir cliqué sur ce bouton, vous pourrez sélectionner les positions dans le calendrier en cliquant dessus.',
    position: 'bottom',
    highlightTargets: ['[data-tutorial="desiderata-primary"] button'],
    icon: <Calendar className="h-5 w-5 text-red-600" />,
    important: true
  },
  { 
    target: '[data-tutorial="desiderata-secondary"]',
    title: 'Desiderata Secondaires',
    content: 'Ce bouton bleu vous permet de sélectionner vos desiderata secondaires.\n\nCe sont les indisponibilités que vous aimeriez obtenir, mais qui sont moins importantes que vos souhaits prioritaires.\n\nAprès avoir cliqué sur ce bouton, vous pourrez sélectionner les positions dans le calendrier en cliquant dessus.',
    position: 'bottom',
    highlightTargets: ['[data-tutorial="desiderata-secondary"] button'],
    icon: <Calendar className="h-5 w-5 text-blue-600" />,
    important: true
  },
  {
    target: '[data-tutorial="planning-grid"]',
    title: 'Sélectionner des Positions',
    content: 'Pour sélectionner les positions que vous souhaitez:\n\n1. Cliquez d\'abord sur le bouton rouge (desiderata prioritaires) ou bleu (desiderata secondaires)\n\n2. Ensuite, cliquez sur les cases du calendrier ou faites glisser votre souris pour sélectionner plusieurs positions d\'un coup\n\n3. Les cases sélectionnées changeront de couleur: rouge pour les prioritaires, bleu pour les secondaires',
    position: 'top',
    highlightTargets: ['[data-tutorial="planning-grid"]'],
    icon: <Clock className="h-5 w-5 text-orange-600" />,
    important: true
  },
  {
    target: '[data-tutorial="planning-grid"]',
    title: 'Ajouter un Commentaire',
    content: 'Vous pouvez ajouter un commentaire à une position pour donner plus d\'informations.\n\n1. Faites un clic droit sur une case déjà sélectionnée (ou appui long sur mobile)\n\n2. Une fenêtre s\'ouvrira pour écrire votre commentaire\n\n3. Une icône de note (📝) apparaîtra sur la case pour indiquer qu\'elle a un commentaire',
    position: 'top',
    highlightTargets: ['[data-tutorial="planning-grid"]'],
    icon: <HelpCircle className="h-5 w-5 text-orange-600" />
  },
  {
    target: '[data-tutorial="percentages"]',
    title: 'Suivre vos Limites',
    content: 'Ces pourcentages vous montrent combien de positions vous avez sélectionnées par rapport au maximum autorisé.\n\nAttention: il y a une limite au nombre de positions que vous pouvez sélectionner, vous ne pouvez pas la dépasser.\n\nSurveillez ces indicateurs pour rester dans les limites autorisées.',
    position: 'bottom',
    highlightTargets: ['[data-tutorial="percentages"] span'],
    icon: <HelpCircle className="h-5 w-5 text-indigo-500" />,
    important: true
  },
  {
    target: '[data-tutorial="validate-button"]',
    title: 'Valider vos Desiderata',
    content: 'Une fois que vous avez terminé de sélectionner toutes vos positions souhaitées, cliquez sur ce bouton pour enregistrer vos choix. Vous pouvez enregistrer et mettre à jour vos desiderata à tout moment avant la date limite.\n\nATTENTION: Une fois la date limite passée, vous ne pourrez plus modifier vos desiderata!',
    position: 'bottom',
    highlightTargets: ['[data-tutorial="validate-button"] button'],
    icon: <CheckCircle className="h-5 w-5 text-green-600" />,
    important: true
  }
];

interface TutorialProps {
  isOpen: boolean;
  onClose: () => void;
}

// Fonction utilitaire pour obtenir les dimensions et la position sûre du tooltip
const calculateTooltipPosition = (targetElement: Element, position: string, tooltipWidth: number, tooltipHeight: number) => {
  const rect = targetElement.getBoundingClientRect();
  const windowHeight = window.innerHeight;
  const windowWidth = window.innerWidth;
  const margin = window.innerWidth < 640 ? 8 : 16;
  
  let top = 0;
  let left = 0;
  let origin = 'center';
  
  // Calcul de la position horizontale
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
  
  // Calcul de la position verticale
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
  
  // Ajustement pour les mobiles
  if (window.innerWidth < 640) {
    const spaceAbove = rect.top;
    const spaceBelow = windowHeight - rect.bottom;
    
    if (spaceBelow > tooltipHeight + margin * 2 || spaceBelow > spaceAbove) {
      top = rect.bottom + margin * 2;
      origin = 'top';
    } else {
      top = Math.max(margin, rect.top - tooltipHeight - margin * 2);
      origin = 'bottom';
    }
    
    left = windowWidth / 2 - tooltipWidth / 2;
  }
  
  // S'assurer que le tooltip reste dans les limites de l'écran
  top = Math.max(margin, Math.min(windowHeight - tooltipHeight - margin, top));
  left = Math.max(margin, Math.min(windowWidth - tooltipWidth - margin, left));
  
  return { top, left, transformOrigin: origin };
};

// Fonction pour appliquer/nettoyer les surlignages
const applyHighlights = (targets: string[] | undefined, shouldApply: boolean) => {
  // Nettoyer d'abord tous les highlights existants
  document.querySelectorAll('.ring-indigo-500, .ring-amber-500, .animate-pulse').forEach(el => {
    [...HIGHLIGHT_CLASSES.standard, ...HIGHLIGHT_CLASSES.button, 'scale-110', 'transition-all', 'duration-300', 'ease-in-out'].forEach(className => {
      el.classList.remove(className);
    });
  });
  
  // Si on doit appliquer de nouveaux highlights et qu'il y a des targets
  if (shouldApply && targets && targets.length > 0) {
    targets.forEach(target => {
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
};

const Tutorial: React.FC<TutorialProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipStyle, setTooltipStyle] = useState({
    top: 0,
    left: 0,
    transformOrigin: 'center'
  });
  
  // Utilisation de useCallback pour optimiser les fonctions de navigation
  const handleNext = useCallback(() => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      setCurrentStep(0);
      onClose();
    }
  }, [currentStep, onClose]);
  
  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);
  
  const handleClose = useCallback(() => {
    setCurrentStep(0);
    onClose();
  }, [onClose]);
  
  // Effet pour gérer le positionnement du tooltip et les highlights
  useEffect(() => {
    if (!isOpen) return;
    
    const positionTooltip = () => {
      const currentTarget = document.querySelector(tutorialSteps[currentStep].target);
      if (!currentTarget) return;
      
      // Calculer les dimensions du tooltip
      const isMobile = window.innerWidth < 640;
      const tooltipWidth = isMobile ? window.innerWidth * 0.92 : Math.min(448, window.innerWidth * 0.8);
      const tooltipHeight = isMobile ? 280 : 240;
      
      // Obtenir la position optimale du tooltip
      const position = calculateTooltipPosition(
        currentTarget,
        tutorialSteps[currentStep].position,
        tooltipWidth,
        tooltipHeight
      );
      
      setTooltipStyle(position);
      
      // Appliquer les highlights avec un léger délai pour éviter les problèmes de rendu
      setTimeout(() => {
        applyHighlights(tutorialSteps[currentStep].highlightTargets, true);
      }, 100);
    };
    
    // Appliquer le positionnement initial
    positionTooltip();
    
    // Utiliser requestAnimationFrame pour optimiser les événements de scroll/resize
    let ticking = false;
    const handleScrollResize = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          positionTooltip();
          ticking = false;
        });
        ticking = true;
      }
    };
    
    window.addEventListener('resize', handleScrollResize);
    window.addEventListener('scroll', handleScrollResize);
    
    return () => {
      window.removeEventListener('resize', handleScrollResize);
      window.removeEventListener('scroll', handleScrollResize);
      applyHighlights([], false);
    };
  }, [currentStep, isOpen]);
  
  if (!isOpen) return null;
  
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
          animation: `fadeIn ${ANIMATION_DURATION} forwards`
        }}
      >
        <div className="p-4 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {tutorialSteps[currentStep].icon && (
                <div className="p-2 bg-amber-50/90 rounded-full flex-shrink-0 shadow-sm">
                  {tutorialSteps[currentStep].icon}
                </div>
              )}
              <h3 className={`text-lg sm:text-xl font-semibold ${tutorialSteps[currentStep].important ? 'text-indigo-700' : 'text-gray-900'}`}>
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
          <div className="bg-gray-50 p-4 rounded-md mb-4 text-sm sm:text-base text-gray-700 leading-relaxed whitespace-pre-line">
            {tutorialSteps[currentStep].content}
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1 text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
              <span className="font-medium text-indigo-600">{currentStep + 1}</span>
              <span className="text-gray-400">/</span>
              <span>{tutorialSteps.length}</span>
            </div>
            <div className="flex gap-2">
              {currentStep > 0 && (
                <button
                  onClick={handlePrevious}
                  className="px-4 py-2 text-base text-gray-600 hover:text-gray-900 transition-colors border border-gray-200 rounded-md hover:bg-gray-50"
                >
                  Précédent
                </button>
              )}
              <button
                onClick={handleNext}
                className="px-4 py-2 text-base font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:outline-none shadow-sm"
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

export default Tutorial;