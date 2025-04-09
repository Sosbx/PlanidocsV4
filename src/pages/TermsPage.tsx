import React from 'react';
import { ArrowLeft, Shield, Users, Lock, Clock, Repeat, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TermsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Retour
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Règles d'utilisation</h1>

        <div className="space-y-8">
          {/* Section Confidentialité */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Shield className="h-6 w-6 text-indigo-600" />
              <h2>Confidentialité et Protection des Données</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p>• Les informations personnelles et les plannings sont strictement confidentiels</p>
              <p>• L'accès est réservé uniquement aux utilisateurs autorisés</p>
              <p>• Ne partagez jamais vos identifiants de connexion</p>
              <p>• Déconnectez-vous après chaque utilisation</p>
            </div>
          </section>

          {/* Section Utilisation */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Users className="h-6 w-6 text-indigo-600" />
              <h2>Utilisation Responsable</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p>• Remplissez vos desiderata de manière réfléchie et équitable</p>
              <p>• Respectez les délais de soumission</p>
              <p>• Vérifiez vos sélections avant validation</p>
              <p>• Consultez régulièrement votre planning pour rester informé</p>
            </div>
          </section>

          {/* Section Bourse aux Gardes */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Repeat className="h-6 w-6 text-indigo-600" />
              <h2>Bourse aux Gardes</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p>• Proposez uniquement des gardes que vous ne pouvez pas assurer</p>
              <p>• Répondez rapidement aux propositions d'échange</p>
              <p>• Vérifiez la compatibilité avec votre planning avant de vous positionner</p>
              <p>• Informez rapidement en cas d'impossibilité d'honorer un échange</p>
            </div>
          </section>

          {/* Section Délais */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Clock className="h-6 w-6 text-indigo-600" />
              <h2>Respect des Délais</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p>• Respectez strictement la date limite de soumission des desiderata</p>
              <p>• Anticipez vos demandes d'échange de garde</p>
              <p>• Consultez régulièrement les notifications du système</p>
            </div>
          </section>

          {/* Section Sécurité */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Lock className="h-6 w-6 text-indigo-600" />
              <h2>Sécurité</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p>• Utilisez un mot de passe fort et unique</p>
              <p>• Ne conservez pas votre session ouverte sur des postes partagés</p>
              <p>• Signalez immédiatement toute activité suspecte</p>
            </div>
          </section>

          {/* Section Sanctions */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <AlertTriangle className="h-6 w-6 text-indigo-600" />
              <h2>Non-respect des Règles</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p>• Le non-respect des règles peut entraîner la suspension temporaire de l'accès</p>
              <p>• Les utilisations frauduleuses seront signalées à l'administration</p>
              <p>• La confidentialité des données est protégée par la loi</p>
            </div>
          </section>
        </div>

        <div className="mt-12 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500 text-center">
            Ces règles d'utilisation sont destinées à assurer le bon fonctionnement du service et la protection des données de tous les utilisateurs.
            Leur respect est essentiel pour maintenir un environnement de travail efficace et sécurisé.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;