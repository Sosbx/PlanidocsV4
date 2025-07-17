import React from 'react';
import { createParisDate } from '@/utils/timezoneUtils';
import { ArrowLeft, Shield, Lock, Eye, Database, Bell, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatParisDate } from '../utils/timezoneUtils';

const PrivacyPage: React.FC = () => {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Politique de Confidentialité</h1>
        
        <div className="prose prose-blue max-w-none space-y-8">
          {/* Introduction */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Shield className="h-6 w-6 text-blue-600" />
              <h2>Introduction</h2>
            </div>
            <p className="text-gray-600">
              PlaniDocs s'engage à protéger la confidentialité des données personnelles de ses utilisateurs.
              Cette politique de confidentialité explique comment nous collectons, utilisons et protégeons vos informations.
            </p>
          </section>

          {/* Données collectées */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Database className="h-6 w-6 text-blue-600" />
              <h2>Données collectées</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p>Nous collectons les informations suivantes :</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Nom et prénom</li>
                <li>Adresse email professionnelle</li>
                <li>Données de planning et de préférences</li>
                <li>Données de connexion et d'utilisation</li>
              </ul>
            </div>
          </section>

          {/* Utilisation des données */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Eye className="h-6 w-6 text-blue-600" />
              <h2>Utilisation des données</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p>Vos données sont utilisées pour :</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Gérer votre compte et authentification</li>
                <li>Organiser les plannings et gardes</li>
                <li>Faciliter les échanges de garde</li>
                <li>Améliorer nos services</li>
              </ul>
            </div>
          </section>

          {/* Google Calendar */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Share2 className="h-6 w-6 text-blue-600" />
              <h2>Intégration Google Calendar</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p>
                L'application peut se connecter à Google Calendar pour synchroniser vos gardes.
                Cette fonctionnalité :
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Nécessite votre autorisation explicite</li>
                <li>Accède uniquement aux données de calendrier nécessaires</li>
                <li>Ne partage aucune donnée avec des tiers</li>
                <li>Peut être révoquée à tout moment</li>
              </ul>
            </div>
          </section>

          {/* Protection des données */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Lock className="h-6 w-6 text-blue-600" />
              <h2>Protection des données</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p>Nous protégeons vos données par :</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Chiffrement des données en transit et au repos</li>
                <li>Accès restreint et contrôlé aux données</li>
                <li>Surveillance continue de la sécurité</li>
                <li>Mises à jour régulières de sécurité</li>
              </ul>
            </div>
          </section>

          {/* Notifications */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Bell className="h-6 w-6 text-blue-600" />
              <h2>Notifications</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p>
                Nous envoyons des notifications par email pour :
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Rappels de garde</li>
                <li>Propositions d'échange</li>
                <li>Informations importantes sur le service</li>
              </ul>
              <p>
                Ces notifications sont essentielles au fonctionnement du service et ne peuvent être désactivées.
              </p>
            </div>
          </section>

          {/* Contact */}
          <section className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">
              Pour toute question concernant cette politique de confidentialité ou vos données personnelles,
              contactez l'administrateur système.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Dernière mise à jour : {formatParisDate(createParisDate(), 'dd/MM/yyyy')}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;