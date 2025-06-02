import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks';
import { useFeatureFlags } from '../context/featureFlags/FeatureFlagsContext';
import { useSuperAdmin } from '../context/superAdmin/SuperAdminContext';
import { FEATURES } from '../types/featureFlags';
import { getGreetingByTime } from '../utils/timeUtils';
import {
  Calendar,
  Settings,
  Users,
  CheckSquare,
  Repeat,
  CalendarClock,
  UserCircle,
  HelpCircle,
  FileText,
  Shield,
  CalendarOff,
  RefreshCw,
  FileSpreadsheet
} from 'lucide-react';
import LogoImage from '../assets/images/Logo.png';

interface DashboardCardProps {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  disabled?: boolean;
  isDev?: boolean;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ to, icon, title, description, color, disabled, isDev }) => {
  // Si c'est en développement, afficher la carte mais désactivée
  if (isDev) {
    return (
      <div
        className={`relative group p-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden cursor-not-allowed opacity-60`}
      >
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-2.5 bg-gray-50/50 rounded-lg transition-colors">
              {icon}
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              {title}
              <span className="text-xs ml-2 text-orange-500">(Dev)</span>
            </h3>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
          <p className="text-xs text-orange-500 mt-2 font-medium">En développement</p>
        </div>
        <div className="absolute inset-0 bg-gray-50/30" />
      </div>
    );
  }

  // Si c'est complètement désactivé, ne pas afficher la carte du tout
  if (disabled) {
    return null;
  }

  // Sinon, afficher la carte normale et cliquable
  return (
    <Link
      to={to}
      className={`relative group p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-200 ${color} overflow-hidden`}
    >
      <div className="relative z-10">
        <div className="flex items-center gap-4 mb-3">
          <div className="p-2.5 bg-gray-50 rounded-lg group-hover:bg-gray-100 transition-colors">
            {icon}
          </div>
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
      </div>
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-gray-50/30 opacity-0 group-hover:opacity-100 transition-all duration-300" />
    </Link>
  );
};

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { isFeatureEnabled, getFeatureStatus } = useFeatureFlags();
  const { isSuperAdminMode, canAccessSuperAdmin } = useSuperAdmin();

  if (!user) return null;

  // Définition de tous les cartes utilisateur
  const allUserCards = [
    {
      to: "/user",
      icon: <CalendarOff className="h-6 w-6 text-sky-600" />,
      title: "Désidérata",
      description: "Saisir mes desiderata",
      color: "hover:border-sky-500 hover:bg-gradient-to-br hover:from-sky-50 hover:to-blue-50/50",
      disabled: (canAccessSuperAdmin && isSuperAdminMode) ? false : getFeatureStatus(FEATURES.DESIDERATA) === 'disabled',
      isDev: (canAccessSuperAdmin && isSuperAdminMode) ? false : getFeatureStatus(FEATURES.DESIDERATA) === 'dev'
    },
    {
      to: "/planning",
      icon: <Calendar className="h-6 w-6 text-teal-600" />,
      title: "Planning",
      description: "Consulter mon planning et échanger mes gardes",
      color: "hover:border-teal-500 hover:bg-gradient-to-br hover:from-teal-50 hover:to-emerald-50/50",
      disabled: (canAccessSuperAdmin && isSuperAdminMode) ? false : getFeatureStatus(FEATURES.PLANNING) === 'disabled',
      isDev: (canAccessSuperAdmin && isSuperAdminMode) ? false : getFeatureStatus(FEATURES.PLANNING) === 'dev'
    },
    {
      to: "/shift-exchange",
      icon: <Repeat className="h-6 w-6 text-violet-600" />,
      title: "BaG",
      description: "Interagir avec la bourse aux gardes",
      color: "hover:border-violet-500 hover:bg-gradient-to-br hover:from-violet-50 hover:to-purple-50/50",
      disabled: (canAccessSuperAdmin && isSuperAdminMode) ? false : getFeatureStatus(FEATURES.SHIFT_EXCHANGE) === 'disabled',
      isDev: (canAccessSuperAdmin && isSuperAdminMode) ? false : getFeatureStatus(FEATURES.SHIFT_EXCHANGE) === 'dev'
    },
    {
      to: "/direct-exchange",
      icon: <RefreshCw className="h-6 w-6 text-orange-600" />,
      title: "Échanges",
      description: "Céder, échanger ou se faire remplacer",
      color: "hover:border-orange-500 hover:bg-gradient-to-br hover:from-orange-50 hover:to-amber-50/50",
      disabled: (canAccessSuperAdmin && isSuperAdminMode) ? false : getFeatureStatus(FEATURES.DIRECT_EXCHANGE) === 'disabled',
      isDev: (canAccessSuperAdmin && isSuperAdminMode) ? false : getFeatureStatus(FEATURES.DIRECT_EXCHANGE) === 'dev'
    }
  ];
  
  // Afficher toutes les cartes non désactivées
  const userCards = allUserCards;

  // Définition de toutes les cartes administrateur
  const allAdminCards = [
    {
      to: "/admin",
      icon: <Settings className="h-6 w-6 text-indigo-600" />,
      title: "Gestion des désidérata",
      description: "Configurer les paramètres des desiderata",
      color: "hover:border-indigo-500 hover:bg-gradient-to-br hover:from-indigo-50 hover:to-blue-50/50",
      disabled: (canAccessSuperAdmin && isSuperAdminMode) ? false : getFeatureStatus(FEATURES.ADMIN_DESIDERATA) === 'disabled',
      isDev: (canAccessSuperAdmin && isSuperAdminMode) ? false : getFeatureStatus(FEATURES.ADMIN_DESIDERATA) === 'dev'
    },
    {
      to: "/admin-shift-exchange",
      icon: <Repeat className="h-6 w-6 text-fuchsia-600" />,
      title: "Gestion BaG",
      description: "Gérer la bourse aux gardes",
      color: "hover:border-fuchsia-500 hover:bg-gradient-to-br hover:from-fuchsia-50 hover:to-pink-50/50",
      disabled: (canAccessSuperAdmin && isSuperAdminMode) ? false : getFeatureStatus(FEATURES.ADMIN_SHIFT_EXCHANGE) === 'disabled',
      isDev: (canAccessSuperAdmin && isSuperAdminMode) ? false : getFeatureStatus(FEATURES.ADMIN_SHIFT_EXCHANGE) === 'dev'
    },
    {
      to: "/direct-exchange",
      icon: <RefreshCw className="h-6 w-6 text-orange-600" />,
      title: "Échanges",
      description: "Gérer les cessions, échanges et remplacements entre médecins",
      color: "hover:border-orange-500 hover:bg-gradient-to-br hover:from-orange-50 hover:to-amber-50/50",
      disabled: (canAccessSuperAdmin && isSuperAdminMode) ? false : getFeatureStatus(FEATURES.DIRECT_EXCHANGE) === 'disabled',
      isDev: (canAccessSuperAdmin && isSuperAdminMode) ? false : getFeatureStatus(FEATURES.DIRECT_EXCHANGE) === 'dev'
    },
    {
      to: "/generated-planning",
      icon: <FileSpreadsheet className="h-6 w-6 text-cyan-600" />,
      title: "Gestion Planning",
      description: "Importer et visualiser les plannings",
      color: "hover:border-cyan-500 hover:bg-gradient-to-br hover:from-cyan-50 hover:to-sky-50/50",
      disabled: (canAccessSuperAdmin && isSuperAdminMode) ? false : getFeatureStatus(FEATURES.GENERATED_PLANNING) === 'disabled',
      isDev: (canAccessSuperAdmin && isSuperAdminMode) ? false : getFeatureStatus(FEATURES.GENERATED_PLANNING) === 'dev'
    },
    {
      to: "/validated-plannings",
      icon: <CheckSquare className="h-6 w-6 text-emerald-600" />,
      title: "Desiderata Validés",
      description: "Consulter les desiderata validés",
      color: "hover:border-emerald-500 hover:bg-gradient-to-br hover:from-emerald-50 hover:to-green-50/50",
      disabled: (canAccessSuperAdmin && isSuperAdminMode) ? false : getFeatureStatus(FEATURES.ADMIN_DESIDERATA) === 'disabled',
      isDev: (canAccessSuperAdmin && isSuperAdminMode) ? false : getFeatureStatus(FEATURES.ADMIN_DESIDERATA) === 'dev'
    },
    {
      to: "/users",
      icon: <Users className="h-6 w-6 text-amber-600" />,
      title: "Utilisateurs",
      description: "Gérer les comptes utilisateurs",
      color: "hover:border-amber-500 hover:bg-gradient-to-br hover:from-amber-50 hover:to-yellow-50/50",
      disabled: (canAccessSuperAdmin && isSuperAdminMode) ? false : getFeatureStatus(FEATURES.USER_MANAGEMENT) === 'disabled',
      isDev: (canAccessSuperAdmin && isSuperAdminMode) ? false : getFeatureStatus(FEATURES.USER_MANAGEMENT) === 'dev'
    },
    {
      to: "/remplacements",
      icon: <Users className="h-6 w-6 text-purple-600" />,
      title: "Remplacements",
      description: "Gérer les remplacements",
      color: "hover:border-purple-500 hover:bg-gradient-to-br hover:from-purple-50 hover:to-indigo-50/50",
      disabled: (canAccessSuperAdmin && isSuperAdminMode) ? false : getFeatureStatus(FEATURES.REPLACEMENTS) === 'disabled',
      isDev: (canAccessSuperAdmin && isSuperAdminMode) ? false : getFeatureStatus(FEATURES.REPLACEMENTS) === 'dev'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* En-tête avec logo - même style que navbar */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-500 backdrop-blur-md shadow-lg py-2 sm:py-3">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <img 
                src={LogoImage} 
                alt="PlaniDoc Logo" 
                className="h-16 w-16 sm:h-20 sm:w-20 object-contain"
              />
              <h1 className="ml-3 text-2xl sm:text-4xl font-bold text-white flex items-start">
                PlaniDoc<span className="text-sm sm:text-base">s</span>
              </h1>
            </div>
            <Link
              to="/profile"
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 text-sm font-medium text-white bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 shadow-md transition-all duration-200"
            >
              <UserCircle className="h-5 w-5" />
              <span className="hidden sm:inline">{user.firstName} {user.lastName}</span>
              <span className="sm:hidden">{user.firstName}</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:py-16">
        <div className="flex flex-col gap-4 mb-12">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold text-gray-900">
              {getGreetingByTime()}, {user.firstName} <span className="text-yellow-500">👋</span>
            </h1>
            <p className="mt-2 sm:mt-3 text-gray-600 text-base sm:text-lg font-light">
              Que souhaitez-vous faire aujourd'hui ?
            </p>
          </div>
        </div>

        {user.roles.isUser && (
          <div className="mb-16">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {userCards.map((card, index) => (
                <DashboardCard key={index} {...card} />
              ))}
            </div>
          </div>
        )}

        {user.roles.isAdmin && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {allAdminCards.map((card, index) => (
                <DashboardCard key={index} {...card} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 sm:mt-12 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 bg-blue-50 border border-blue-200 rounded-xl p-6 flex items-start gap-4 shadow-sm hover:shadow-md transition-all">
            <HelpCircle className="h-6 w-6 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm sm:text-base font-medium text-blue-900">Besoin d'aide ?</h3>
              <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm leading-relaxed text-blue-700">
                Cliquez sur l'icône "TUTORIEL" disponible dans chaque section pour découvrir son fonctionnement.
              </p>
            </div>
          </div>
          <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-6 flex items-start gap-4 shadow-sm hover:shadow-md transition-all">
            <Link to="/terms" className="flex-1 flex items-start gap-4 group">
              <FileText className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
              <div>
                <h3 className="text-sm sm:text-base font-medium text-green-900 group-hover:text-green-700 transition-colors">Règles d'utilisation</h3>
                <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm leading-relaxed text-green-700 group-hover:text-green-600 transition-colors">
                  Consultez les règles d'utilisation et de confidentialité de l'application.
                </p>
              </div>
            </Link>
          </div>
          <div className="flex-1 bg-blue-50 border border-blue-200 rounded-xl p-6 flex items-start gap-4 shadow-sm hover:shadow-md transition-all">
            <Link to="/privacy" className="flex-1 flex items-start gap-4 group">
              <Shield className="h-6 w-6 text-blue-500 flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
              <div>
                <h3 className="text-sm sm:text-base font-medium text-blue-900 group-hover:text-blue-700 transition-colors">Politique de confidentialité</h3>
                <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm leading-relaxed text-blue-700 group-hover:text-blue-600 transition-colors">
                  Découvrez comment nous protégeons vos données personnelles.
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
