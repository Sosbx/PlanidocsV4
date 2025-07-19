import React from 'react';
import { ArrowLeft, Shield, Users, Lock, Clock, Repeat, AlertTriangle, FileText, Scale, Heart, Ban } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createParisDate } from '@/utils/timezoneUtils';
import { formatParisDate } from '../utils/timezoneUtils';

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
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Conditions Générales d'Utilisation</h1>
        <p className="text-sm text-gray-500 mb-8">Dernière mise à jour : {formatParisDate(createParisDate(), 'dd/MM/yyyy')}</p>

        <div className="space-y-8">
          {/* Article 1 - Objet */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <FileText className="h-6 w-6 text-indigo-600" />
              <h2>Article 1 - Objet et acceptation</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p>
                Les présentes Conditions Générales d'Utilisation (CGU) régissent l'utilisation de la plateforme Planidocs,
                service de gestion de planning et d'échange de gardes médicales entre professionnels de santé.
              </p>
              <p>
                L'utilisation de Planidocs implique l'acceptation pleine et entière des présentes CGU.
                Tout utilisateur qui n'accepte pas ces conditions doit s'abstenir d'utiliser la plateforme.
              </p>
            </div>
          </section>

          {/* Article 2 - Définitions */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <FileText className="h-6 w-6 text-indigo-600" />
              <h2>Article 2 - Définitions</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Plateforme</strong> : le service Planidocs accessible via l'application web</li>
                <li><strong>Utilisateur</strong> : tout professionnel de santé inscrit sur la plateforme</li>
                <li><strong>Associations RG/RD</strong> : structures médicales liées utilisant la plateforme</li>
                <li><strong>Garde</strong> : période de service médical assignée à un professionnel</li>
                <li><strong>Échange</strong> : processus de permutation de gardes entre utilisateurs</li>
                <li><strong>Remplaçant</strong> : professionnel de santé effectuant des remplacements</li>
              </ul>
            </div>
          </section>

          {/* Article 3 - Inscription et compte */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Users className="h-6 w-6 text-indigo-600" />
              <h2>Article 3 - Inscription et compte utilisateur</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p className="font-semibold">3.1 Conditions d'inscription</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Être un professionnel de santé en exercice</li>
                <li>Être membre d'une des associations RG/RD</li>
                <li>Fournir des informations exactes et à jour</li>
                <li>Maintenir la confidentialité de ses identifiants</li>
              </ul>
              
              <p className="font-semibold mt-4">3.2 Responsabilité du compte</p>
              <p>
                L'utilisateur est seul responsable de l'utilisation faite de son compte.
                Toute action effectuée via son compte est présumée avoir été réalisée par lui-même.
              </p>
            </div>
          </section>

          {/* Article 4 - Utilisation du service */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Repeat className="h-6 w-6 text-indigo-600" />
              <h2>Article 4 - Utilisation du service</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p className="font-semibold">4.1 Services disponibles</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Consultation et gestion des plannings de garde</li>
                <li>Soumission de desiderata pour les périodes futures</li>
                <li>Participation à la bourse aux gardes centralisée</li>
                <li>Échanges directs de gardes entre médecins</li>
                <li>Recherche et proposition de remplacements</li>
                <li>Synchronisation avec Google Calendar (optionnelle)</li>
              </ul>

              <p className="font-semibold mt-4">4.2 Règles d'utilisation</p>
              <p>L'utilisateur s'engage à :</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Utiliser la plateforme de manière professionnelle et éthique</li>
                <li>Respecter les délais de soumission des desiderata</li>
                <li>Honorer les échanges de garde validés</li>
                <li>Ne pas perturber le fonctionnement de la plateforme</li>
                <li>Respecter la déontologie médicale dans tous les échanges</li>
              </ul>

              <p className="font-semibold mt-4">4.3 Bourse aux gardes</p>
              <p>
                La bourse aux gardes fonctionne selon un cycle de phases définies 
                (soumission, appariement, validation). Les utilisateurs doivent respecter 
                les phases et les décisions du système d'appariement.
              </p>
            </div>
          </section>

          {/* Article 5 - Responsabilités */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Scale className="h-6 w-6 text-indigo-600" />
              <h2>Article 5 - Responsabilités</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p className="font-semibold">5.1 Responsabilité de l'utilisateur</p>
              <p>
                L'utilisateur est entièrement responsable des échanges de garde qu'il effectue.
                Il doit s'assurer de la continuité des soins et du respect de ses obligations professionnelles.
              </p>

              <p className="font-semibold mt-4">5.2 Limitation de responsabilité</p>
              <p>
                Planidocs agit comme intermédiaire technique et ne peut être tenu responsable :
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Des conséquences des échanges effectués entre utilisateurs</li>
                <li>De l'indisponibilité temporaire du service</li>
                <li>Des erreurs ou omissions dans les plannings</li>
                <li>Des dommages indirects liés à l'utilisation du service</li>
              </ul>

              <p className="font-semibold mt-4">5.3 Force majeure</p>
              <p>
                La responsabilité de Planidocs ne pourra être engagée en cas de force majeure
                ou de faits indépendants de sa volonté.
              </p>
            </div>
          </section>

          {/* Article 6 - Propriété intellectuelle */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Shield className="h-6 w-6 text-indigo-600" />
              <h2>Article 6 - Propriété intellectuelle</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p>
                La plateforme Planidocs, son contenu et ses fonctionnalités sont protégés
                par les droits de propriété intellectuelle. Toute reproduction, représentation
                ou exploitation non autorisée est interdite.
              </p>
            </div>
          </section>

          {/* Article 7 - Protection des données */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Lock className="h-6 w-6 text-indigo-600" />
              <h2>Article 7 - Protection des données personnelles</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p>
                Le traitement des données personnelles est effectué conformément au Règlement
                Général sur la Protection des Données (RGPD) et à la législation française.
                Pour plus d'informations, consultez notre{' '}
                <button
                  onClick={() => navigate('/privacy')}
                  className="text-indigo-600 hover:text-indigo-800 underline"
                >
                  Politique de Confidentialité
                </button>.
              </p>
            </div>
          </section>

          {/* Article 8 - Modification et résiliation */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Ban className="h-6 w-6 text-indigo-600" />
              <h2>Article 8 - Modification et résiliation</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p className="font-semibold">8.1 Modification des CGU</p>
              <p>
                Planidocs se réserve le droit de modifier les présentes CGU à tout moment.
                Les utilisateurs seront informés de toute modification substantielle.
              </p>

              <p className="font-semibold mt-4">8.2 Résiliation</p>
              <p>
                L'utilisateur peut demander la suppression de son compte à tout moment.
                Planidocs peut suspendre ou résilier l'accès en cas de non-respect des CGU.
              </p>
            </div>
          </section>

          {/* Article 9 - Dispositions médicales */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Heart className="h-6 w-6 text-indigo-600" />
              <h2>Article 9 - Dispositions spécifiques au secteur médical</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p>
                Les utilisateurs s'engagent à respecter les obligations déontologiques
                de leur profession, notamment :
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Assurer la continuité des soins</li>
                <li>Respecter le secret médical</li>
                <li>Maintenir la qualité des soins lors des remplacements</li>
                <li>Informer les patients en cas de changement de praticien</li>
              </ul>
            </div>
          </section>

          {/* Article 10 - Loi applicable */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Scale className="h-6 w-6 text-indigo-600" />
              <h2>Article 10 - Loi applicable et juridiction</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p>
                Les présentes CGU sont régies par le droit français. Tout litige relatif
                à leur interprétation ou exécution relève de la compétence exclusive
                des tribunaux français.
              </p>
            </div>
          </section>
        </div>

        <div className="mt-12 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500 text-center">
            En utilisant Planidocs, vous reconnaissez avoir lu, compris et accepté
            l'intégralité des présentes Conditions Générales d'Utilisation.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;