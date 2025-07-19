import React from 'react';
import { createParisDate } from '@/utils/timezoneUtils';
import { ArrowLeft, Shield, Lock, Eye, Database, Bell, Share2, UserCheck, Clock, FileText, Mail, Globe } from 'lucide-react';
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
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Politique de Confidentialité</h1>
        <p className="text-sm text-gray-500 mb-8">Dernière mise à jour : {formatParisDate(createParisDate(), 'dd/MM/yyyy')}</p>
        
        <div className="prose prose-blue max-w-none space-y-8">
          {/* Introduction */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Shield className="h-6 w-6 text-blue-600" />
              <h2>1. Introduction</h2>
            </div>
            <p className="text-gray-600">
              La protection de vos données personnelles est une priorité pour Planidocs. 
              Cette politique de confidentialité décrit comment nous collectons, utilisons, 
              stockons et protégeons vos données conformément au Règlement Général sur la 
              Protection des Données (RGPD) et à la législation française.
            </p>
          </section>

          {/* Responsable du traitement */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <UserCheck className="h-6 w-6 text-blue-600" />
              <h2>2. Responsable du traitement</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p>
                Le responsable du traitement des données personnelles est :
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-semibold">Planidocs</p>
                <p>Plateforme de gestion de planning médical</p>
                <p>Associations RG/RD</p>
                <p className="mt-2">Contact : support@planidocs.com</p>
              </div>
            </div>
          </section>

          {/* Données collectées */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Database className="h-6 w-6 text-blue-600" />
              <h2>3. Données collectées</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p className="font-semibold">3.1 Données d'identification</p>
              <ul className="list-disc pl-5 space-y-2 mb-4">
                <li>Nom et prénom</li>
                <li>Adresse email professionnelle</li>
                <li>Numéro de téléphone (optionnel)</li>
                <li>Identifiant de connexion</li>
              </ul>

              <p className="font-semibold">3.2 Données professionnelles</p>
              <ul className="list-disc pl-5 space-y-2 mb-4">
                <li>Statut professionnel (médecin, remplaçant)</li>
                <li>Rôle dans l'association (admin, manager, user)</li>
                <li>Département et position</li>
                <li>Statuts particuliers (mi-temps, CAT)</li>
              </ul>

              <p className="font-semibold">3.3 Données d'activité</p>
              <ul className="list-disc pl-5 space-y-2 mb-4">
                <li>Planning de gardes</li>
                <li>Desiderata et préférences</li>
                <li>Historique des échanges et remplacements</li>
                <li>Statistiques d'utilisation</li>
              </ul>

              <p className="font-semibold">3.4 Données techniques</p>
              <ul className="list-disc pl-5 space-y-2 mb-4">
                <li>Logs de connexion</li>
                <li>Adresse IP</li>
                <li>Type de navigateur</li>
                <li>Préférences d'affichage et de notification</li>
              </ul>

              <p className="font-semibold">3.5 Données de remplacement (pour les administrateurs)</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Équipements disponibles</li>
                <li>Localisation du matériel</li>
                <li>Pourcentage de rétrocession</li>
                <li>Commentaires additionnels</li>
              </ul>
            </div>
          </section>

          {/* Finalités du traitement */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Eye className="h-6 w-6 text-blue-600" />
              <h2>4. Finalités du traitement</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p>Vos données personnelles sont traitées pour les finalités suivantes :</p>
              
              <p className="font-semibold mt-4">4.1 Gestion du service</p>
              <ul className="list-disc pl-5 space-y-2 mb-4">
                <li>Création et gestion de votre compte utilisateur</li>
                <li>Authentification et sécurisation de l'accès</li>
                <li>Organisation et affichage des plannings de garde</li>
                <li>Gestion des desiderata et préférences</li>
              </ul>

              <p className="font-semibold">4.2 Fonctionnalités d'échange</p>
              <ul className="list-disc pl-5 space-y-2 mb-4">
                <li>Facilitation des échanges de garde entre médecins</li>
                <li>Gestion de la bourse aux gardes centralisée</li>
                <li>Mise en relation pour les remplacements</li>
                <li>Suivi et historisation des échanges</li>
              </ul>

              <p className="font-semibold">4.3 Communication</p>
              <ul className="list-disc pl-5 space-y-2 mb-4">
                <li>Envoi de notifications liées aux gardes et échanges</li>
                <li>Communications importantes sur le service</li>
                <li>Rappels de garde (si activés)</li>
              </ul>

              <p className="font-semibold">4.4 Amélioration du service</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Analyse statistique anonymisée de l'utilisation</li>
                <li>Optimisation des fonctionnalités</li>
                <li>Support technique et résolution de problèmes</li>
              </ul>
            </div>
          </section>

          {/* Base légale */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <FileText className="h-6 w-6 text-blue-600" />
              <h2>5. Base légale du traitement</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p>Le traitement de vos données personnelles repose sur les bases légales suivantes :</p>
              
              <p className="font-semibold mt-4">5.1 Exécution d'un contrat</p>
              <p>
                La plupart des traitements sont nécessaires à l'exécution du service 
                de gestion de planning que vous avez accepté d'utiliser.
              </p>

              <p className="font-semibold mt-4">5.2 Intérêt légitime</p>
              <p>
                Certains traitements reposent sur notre intérêt légitime à assurer 
                la continuité des soins et le bon fonctionnement du service médical.
              </p>

              <p className="font-semibold mt-4">5.3 Consentement</p>
              <p>
                Pour certains traitements optionnels (synchronisation Google Calendar, 
                notifications push), nous demandons votre consentement explicite.
              </p>

              <p className="font-semibold mt-4">5.4 Obligations légales</p>
              <p>
                Certaines données peuvent être conservées pour répondre à des 
                obligations légales dans le secteur médical.
              </p>
            </div>
          </section>

          {/* Destinataires des données */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Share2 className="h-6 w-6 text-blue-600" />
              <h2>6. Destinataires des données</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p className="font-semibold">6.1 Au sein de la plateforme</p>
              <p>Vos données peuvent être accessibles à :</p>
              <ul className="list-disc pl-5 space-y-2 mb-4">
                <li>Les administrateurs de la plateforme (accès limité aux fonctions d'administration)</li>
                <li>Les autres médecins (uniquement les informations nécessaires aux échanges)</li>
                <li>Les remplaçants (pour les offres de remplacement uniquement)</li>
              </ul>

              <p className="font-semibold">6.2 Services tiers</p>
              <p>Nous utilisons les services suivants :</p>
              <ul className="list-disc pl-5 space-y-2 mb-4">
                <li><strong>Firebase (Google)</strong> : hébergement, authentification et base de données</li>
                <li><strong>Google Calendar</strong> : synchronisation optionnelle des plannings</li>
              </ul>

              <p className="font-semibold">6.3 Garanties</p>
              <p>
                Nous ne vendons, ne louons ni ne partageons vos données personnelles 
                avec des tiers à des fins commerciales. Tout partage de données est 
                strictement limité aux finalités décrites dans cette politique.
              </p>
            </div>
          </section>

          {/* Transferts internationaux */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Globe className="h-6 w-6 text-blue-600" />
              <h2>7. Transferts internationaux</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p>
                Certaines de vos données peuvent être transférées vers des serveurs 
                situés aux États-Unis (Firebase/Google). Ces transferts sont encadrés par :
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Les clauses contractuelles types de la Commission européenne</li>
                <li>Les garanties appropriées mises en place par Google</li>
                <li>Le respect des standards de sécurité conformes au RGPD</li>
              </ul>
            </div>
          </section>

          {/* Durée de conservation */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Clock className="h-6 w-6 text-blue-600" />
              <h2>8. Durée de conservation</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p>Vos données sont conservées selon les durées suivantes :</p>
              
              <p className="font-semibold mt-4">8.1 Données de compte</p>
              <p>
                Conservées pendant toute la durée d'utilisation du service, puis 
                supprimées dans un délai de 3 mois après la clôture du compte.
              </p>

              <p className="font-semibold mt-4">8.2 Données de planning</p>
              <p>
                Conservées pendant 5 ans conformément aux obligations légales 
                du secteur médical.
              </p>

              <p className="font-semibold mt-4">8.3 Logs techniques</p>
              <p>
                Conservés pendant 12 mois à des fins de sécurité et de diagnostic.
              </p>

              <p className="font-semibold mt-4">8.4 Données d'échange</p>
              <p>
                Conservées pendant 3 ans pour assurer la traçabilité des échanges.
              </p>
            </div>
          </section>

          {/* Droits des utilisateurs */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <UserCheck className="h-6 w-6 text-blue-600" />
              <h2>9. Vos droits</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p>Conformément au RGPD, vous disposez des droits suivants :</p>
              
              <p className="font-semibold mt-4">9.1 Droit d'accès</p>
              <p>
                Vous pouvez obtenir la confirmation que des données vous concernant 
                sont traitées et demander une copie de ces données.
              </p>

              <p className="font-semibold mt-4">9.2 Droit de rectification</p>
              <p>
                Vous pouvez demander la correction de données inexactes ou incomplètes.
              </p>

              <p className="font-semibold mt-4">9.3 Droit à l'effacement</p>
              <p>
                Vous pouvez demander la suppression de vos données, sauf si leur 
                conservation est nécessaire pour des obligations légales.
              </p>

              <p className="font-semibold mt-4">9.4 Droit à la limitation</p>
              <p>
                Vous pouvez demander la limitation du traitement dans certains cas.
              </p>

              <p className="font-semibold mt-4">9.5 Droit à la portabilité</p>
              <p>
                Vous pouvez recevoir vos données dans un format structuré et lisible.
              </p>

              <p className="font-semibold mt-4">9.6 Droit d'opposition</p>
              <p>
                Vous pouvez vous opposer à certains traitements de vos données.
              </p>

              <p className="font-semibold mt-4">9.7 Retrait du consentement</p>
              <p>
                Pour les traitements basés sur votre consentement, vous pouvez 
                le retirer à tout moment.
              </p>

              <p className="font-semibold mt-4">9.8 Réclamation</p>
              <p>
                Vous pouvez introduire une réclamation auprès de la CNIL 
                (Commission Nationale de l'Informatique et des Libertés).
              </p>

              <div className="bg-blue-50 p-4 rounded-lg mt-4">
                <p className="font-semibold">Pour exercer vos droits :</p>
                <p>Contactez l'administrateur de la plateforme ou envoyez un email à [email de contact]</p>
              </div>
            </div>
          </section>

          {/* Sécurité des données */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Lock className="h-6 w-6 text-blue-600" />
              <h2>10. Sécurité des données</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p>
                Nous mettons en œuvre des mesures techniques et organisationnelles 
                appropriées pour protéger vos données :
              </p>
              
              <p className="font-semibold mt-4">10.1 Mesures techniques</p>
              <ul className="list-disc pl-5 space-y-2 mb-4">
                <li>Chiffrement des données en transit (HTTPS) et au repos</li>
                <li>Authentification forte et gestion sécurisée des accès</li>
                <li>Sauvegarde régulière des données</li>
                <li>Protection contre les attaques (firewall, anti-DDoS)</li>
                <li>Surveillance continue de la sécurité</li>
              </ul>

              <p className="font-semibold">10.2 Mesures organisationnelles</p>
              <ul className="list-disc pl-5 space-y-2 mb-4">
                <li>Accès limité aux données selon le principe du moindre privilège</li>
                <li>Formation du personnel à la protection des données</li>
                <li>Procédures de gestion des incidents de sécurité</li>
                <li>Audits réguliers de sécurité</li>
              </ul>

              <p className="font-semibold">10.3 En cas de violation</p>
              <p>
                En cas de violation de données personnelles présentant un risque 
                pour vos droits et libertés, nous nous engageons à vous informer 
                dans les meilleurs délais et à notifier la CNIL sous 72 heures.
              </p>
            </div>
          </section>

          {/* Cookies et technologies similaires */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Database className="h-6 w-6 text-blue-600" />
              <h2>11. Cookies et technologies similaires</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p className="font-semibold">11.1 Cookies utilisés</p>
              <p>Nous utilisons uniquement des cookies essentiels :</p>
              <ul className="list-disc pl-5 space-y-2 mb-4">
                <li><strong>Cookies de session</strong> : pour maintenir votre connexion</li>
                <li><strong>Cookies de préférences</strong> : pour mémoriser vos choix d'affichage</li>
                <li><strong>Cookies de sécurité</strong> : pour protéger contre les attaques</li>
              </ul>

              <p className="font-semibold">11.2 Pas de cookies publicitaires</p>
              <p>
                Nous n'utilisons aucun cookie publicitaire ou de tracking. 
                Aucune donnée n'est partagée avec des régies publicitaires.
              </p>
            </div>
          </section>

          {/* Google Calendar */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Share2 className="h-6 w-6 text-blue-600" />
              <h2>12. Intégration Google Calendar</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p>
                L'application propose une synchronisation optionnelle avec Google Calendar :
              </p>
              <ul className="list-disc pl-5 space-y-2 mb-4">
                <li>Nécessite votre autorisation explicite via OAuth</li>
                <li>Accède uniquement aux calendriers que vous autorisez</li>
                <li>Crée et met à jour les événements de garde</li>
                <li>Ne lit pas vos autres événements personnels</li>
                <li>Peut être révoquée à tout moment depuis votre compte Google</li>
              </ul>
              <p>
                Cette fonctionnalité est entièrement optionnelle et vous gardez 
                le contrôle total sur les données partagées.
              </p>
            </div>
          </section>

          {/* Notifications */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Bell className="h-6 w-6 text-blue-600" />
              <h2>13. Communications et notifications</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p className="font-semibold">13.1 Communications essentielles</p>
              <p>Nous envoyons des communications nécessaires au service :</p>
              <ul className="list-disc pl-5 space-y-2 mb-4">
                <li>Confirmations d'échange de garde</li>
                <li>Rappels de garde (si activés)</li>
                <li>Alertes de sécurité importantes</li>
                <li>Modifications des CGU ou de la politique de confidentialité</li>
              </ul>

              <p className="font-semibold">13.2 Notifications optionnelles</p>
              <p>
                Vous pouvez configurer vos préférences de notification dans 
                votre profil pour recevoir ou non :
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Propositions d'échange</li>
                <li>Offres de remplacement</li>
                <li>Nouveautés du service</li>
              </ul>
            </div>
          </section>

          {/* Modifications */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <FileText className="h-6 w-6 text-blue-600" />
              <h2>14. Modifications de la politique</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p>
                Nous pouvons être amenés à modifier cette politique de confidentialité 
                pour nous conformer aux évolutions légales ou pour refléter des 
                changements dans nos pratiques.
              </p>
              <p>
                En cas de modification substantielle, nous vous informerons par 
                email et/ou via une notification dans l'application. La date de 
                dernière mise à jour sera toujours indiquée en haut de ce document.
              </p>
            </div>
          </section>

          {/* Contact */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-xl font-semibold text-gray-900">
              <Mail className="h-6 w-6 text-blue-600" />
              <h2>15. Contact</h2>
            </div>
            <div className="pl-9 space-y-3 text-gray-600">
              <p>Pour toute question concernant cette politique ou vos données :</p>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-semibold">Contact protection des données</p>
                <p>Email : dpo@planidocs.com</p>
                <p>Adresse : Associations RG/RD</p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg mt-4">
                <p className="font-semibold">CNIL</p>
                <p>Pour toute réclamation, vous pouvez contacter la CNIL :</p>
                <p>Site web : www.cnil.fr</p>
                <p>Adresse : 3 Place de Fontenoy - TSA 80715 - 75334 PARIS CEDEX 07</p>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-12 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500 text-center">
            Cette politique de confidentialité est conforme au Règlement Général 
            sur la Protection des Données (RGPD) et à la législation française 
            en vigueur.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;