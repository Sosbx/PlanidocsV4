import React, { useState } from 'react';
import { Shield, FileText, Check, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createParisDate } from '@/utils/timezoneUtils';

interface FirstLoginConsentProps {
  onAccept: () => Promise<void>;
  userEmail: string;
}

const FirstLoginConsent: React.FC<FirstLoginConsentProps> = ({ onAccept, userEmail }) => {
  const navigate = useNavigate();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedDataProcessing, setAcceptedDataProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = acceptedTerms && acceptedPrivacy && acceptedDataProcessing;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onAccept();
    } catch (err) {
      setError('Une erreur est survenue lors de l\'enregistrement de votre consentement. Veuillez réessayer.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center py-8 px-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-xl p-8">
        {/* En-tête */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Shield className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Bienvenue sur Planidocs
          </h1>
          <p className="text-gray-600">
            Avant de continuer, veuillez prendre connaissance de nos conditions d'utilisation
          </p>
        </div>

        {/* Information utilisateur */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            Compte créé pour : <span className="font-semibold">{userEmail}</span>
          </p>
        </div>

        {/* Liens vers les documents */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
          >
            <FileText className="h-6 w-6 text-indigo-600 mr-3" />
            <div>
              <h3 className="font-semibold text-gray-900">CGU</h3>
              <p className="text-sm text-gray-600">Conditions Générales d'Utilisation</p>
            </div>
          </a>

          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
          >
            <Shield className="h-6 w-6 text-indigo-600 mr-3" />
            <div>
              <h3 className="font-semibold text-gray-900">RGPD</h3>
              <p className="text-sm text-gray-600">Politique de Confidentialité</p>
            </div>
          </a>
        </div>

        {/* Cases à cocher de consentement */}
        <div className="space-y-4 mb-8">
          <label className="flex items-start">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              disabled={isSubmitting}
            />
            <span className="ml-3 text-sm text-gray-700">
              J'ai lu et j'accepte les{' '}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-800 underline"
              >
                Conditions Générales d'Utilisation
              </a>
            </span>
          </label>

          <label className="flex items-start">
            <input
              type="checkbox"
              checked={acceptedPrivacy}
              onChange={(e) => setAcceptedPrivacy(e.target.checked)}
              className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              disabled={isSubmitting}
            />
            <span className="ml-3 text-sm text-gray-700">
              J'ai lu et j'accepte la{' '}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-800 underline"
              >
                Politique de Confidentialité
              </a>
            </span>
          </label>

          <label className="flex items-start">
            <input
              type="checkbox"
              checked={acceptedDataProcessing}
              onChange={(e) => setAcceptedDataProcessing(e.target.checked)}
              className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              disabled={isSubmitting}
            />
            <span className="ml-3 text-sm text-gray-700">
              J'accepte le traitement de mes données personnelles conformément au RGPD 
              pour la gestion de mes plannings de garde et les échanges entre médecins
            </span>
          </label>
        </div>

        {/* Message d'erreur */}
        {error && (
          <div className="rounded-md bg-red-50 p-4 mb-6">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Informations importantes */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-amber-900 mb-2 flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            Informations importantes
          </h4>
          <ul className="text-sm text-amber-800 space-y-1">
            <li>• Vos données sont hébergées de manière sécurisée</li>
            <li>• Elles ne seront jamais vendues à des tiers</li>
            <li>• Vous pouvez exercer vos droits RGPD à tout moment</li>
            <li>• Vous pouvez demander la suppression de votre compte</li>
          </ul>
        </div>

        {/* Boutons d'action */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className={`flex-1 flex items-center justify-center px-6 py-3 rounded-md text-white font-medium transition-colors ${
              canSubmit && !isSubmitting
                ? 'bg-indigo-600 hover:bg-indigo-700'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Enregistrement...
              </>
            ) : (
              <>
                <Check className="h-5 w-5 mr-2" />
                Accepter et continuer
              </>
            )}
          </button>

          <button
            onClick={() => {
              if (window.confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
                navigate('/login');
              }
            }}
            disabled={isSubmitting}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
          >
            Me déconnecter
          </button>
        </div>

        {/* Note de bas de page */}
        <p className="text-xs text-gray-500 text-center mt-6">
          En acceptant, vous confirmez avoir lu et compris l'ensemble de nos conditions.
          Date du consentement : {createParisDate().toLocaleDateString('fr-FR')}
        </p>
      </div>
    </div>
  );
};

export default FirstLoginConsent;