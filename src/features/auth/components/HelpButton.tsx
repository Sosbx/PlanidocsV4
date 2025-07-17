import React, { useState } from 'react';
import { HelpCircle, X, ChevronLeft, ChevronRight, AlertCircle, LogIn } from 'lucide-react';

interface HelpButtonProps {
  className?: string;
}

const HelpButton: React.FC<HelpButtonProps> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const helpSteps = [
    {
      icon: '🌟',
      title: "Connexion recommandée",
      content: [
        { label: "Méthode préférée", value: "Connexion avec Google/H24" },
        { label: "Avantages", value: "Plus rapide et plus sécurisée" },
        { label: "Comment", value: "Cliquez sur le bouton 'Se connecter avec son compte Google/H24'" }
      ],
      alert: false,
      recommended: true
    },
    {
      icon: '👤',
      title: "Connexion classique",
      content: [
        { label: "Identifiant", value: "4 lettres du NOM (ex: DUPO)" },
        { label: "Mot de passe", value: "4 lettres du PRÉNOM + 33 (ex: MARC33)" },
        { label: "Important", value: "Toujours en MAJUSCULES" }
      ]
    },
    {
      icon: '🔐',
      title: "Sécurité",
      content: [
        { label: "Action requise", value: "Modifiez votre mot de passe après la 1ère connexion" },
        { label: "Où", value: "Menu Profil > Modifier mot de passe" }
      ],
      alert: true
    },
    {
      icon: '🔄',
      title: "Autres options",
      content: [
        { label: "Mot de passe oublié", value: "Lien disponible sous le formulaire" },
        { label: "Support", value: "Contactez votre administrateur" }
      ]
    }
  ];

  return (
    <>
      {/* Bouton d'aide flottant */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed top-4 right-4 z-40 bg-white/90 backdrop-blur-sm text-teal-600 px-4 py-2 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 text-sm font-medium border border-teal-100 hover:border-teal-200 ${className}`}
        aria-label="Aide à la connexion"
      >
        <HelpCircle className="h-4 w-4" />
        <span>Aide à la connexion</span>
      </button>

      {/* Modal d'aide */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fadeIn">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm transform animate-slideUp max-h-[90vh] flex flex-col">
            {/* En-tête */}
            <div className="bg-gradient-to-r from-blue-500 to-teal-600 text-white p-4 rounded-t-2xl flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  Aide connexion
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white/80 hover:text-white transition-colors p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Contenu principal */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Indicateurs de navigation */}
              <div className="flex items-center justify-center gap-2 pt-4 pb-2 px-4">
                {helpSteps.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentStep(index)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      index === currentStep 
                        ? 'w-8 bg-teal-600' 
                        : 'w-2 bg-gray-300 hover:bg-gray-400'
                    }`}
                    aria-label={`Étape ${index + 1}`}
                  />
                ))}
              </div>

              {/* Contenu de l'étape actuelle */}
              <div className="flex-1 px-6 py-4">
                <div className="h-full flex flex-col">
                  <div className="text-center mb-4">
                    <div className="text-4xl mb-2">{helpSteps[currentStep].icon}</div>
                    <h4 className={`text-lg font-bold ${
                      helpSteps[currentStep].alert ? 'text-orange-600' : 
                      helpSteps[currentStep].recommended ? 'text-green-600' : 'text-gray-800'
                    }`}>
                      {helpSteps[currentStep].title}
                    </h4>
                  </div>

                  <div className="space-y-3 flex-1">
                    {helpSteps[currentStep].content.map((item, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <span className="text-sm font-medium text-gray-500 min-w-[80px]">
                          {item.label}:
                        </span>
                        <span className={`text-sm ${
                          helpSteps[currentStep].alert && index === 0
                            ? 'font-semibold text-orange-600'
                            : 'text-gray-700'
                        }`}>
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-2xl flex-shrink-0">
                <button
                  onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                  disabled={currentStep === 0}
                  className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                    currentStep === 0
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-teal-600 hover:text-teal-700'
                  }`}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Précédent
                </button>

                <span className="text-xs text-gray-500">
                  {currentStep + 1} / {helpSteps.length}
                </span>

                <button
                  onClick={() => setCurrentStep(Math.min(helpSteps.length - 1, currentStep + 1))}
                  disabled={currentStep === helpSteps.length - 1}
                  className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                    currentStep === helpSteps.length - 1
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-teal-600 hover:text-teal-700'
                  }`}
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

export default HelpButton;