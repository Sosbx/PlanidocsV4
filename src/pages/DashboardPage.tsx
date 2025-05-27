import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks';
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
  Shield
} from 'lucide-react';
import LogoImage from '../assets/images/Logo.png';

interface DashboardCardProps {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  disabled?: boolean;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ to, icon, title, description, color, disabled }) => (
  disabled ? (
    <div
      className={`relative group p-6 bg-white rounded-xl shadow-sm border-2 border-gray-100 overflow-hidden cursor-not-allowed opacity-60`}
    >
      <div className="relative z-10">
        <div className="flex items-center gap-4 mb-3">
          <div className="p-2.5 bg-gray-50/50 rounded-lg transition-colors">
            {icon}
          </div>
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
        <p className="text-xs text-red-500 mt-2 font-medium">En développement</p>
      </div>
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-gray-50/50 opacity-0 transition-all duration-500" />
    </div>
  ) : (
    <Link
      to={to}
      className={`relative group p-6 bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border-2 border-gray-100 ${color} overflow-hidden transform hover:-translate-y-0.5`}
    >
      <div className="relative z-10">
        <div className="flex items-center gap-4 mb-3">
          <div className="p-2.5 bg-gray-50/50 rounded-lg group-hover:bg-white transition-colors">
            {icon}
          </div>
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
      </div>
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-gray-50/50 opacity-0 group-hover:opacity-100 transition-all duration-500" />
    </Link>
  )
);

const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  if (!user) return null;

  // Définition de tous les cartes utilisateur
  const allUserCards = [
    {
      to: "/planning",
      icon: <CalendarClock className="h-6 w-6 text-teal-600" />,
      title: "Mon Planning",
      description: "Consulter mon planning et échanger mes Gardes",
      color: "hover:border-teal-500 hover:bg-gradient-to-br hover:from-teal-50 hover:to-emerald-50/50",
      disabled: true // Temporairement désactivé
    },
    {
      to: "/user",
      icon: <Calendar className="h-6 w-6 text-sky-600" />,
      title: "Desiderata",
      description: "Saisisir mes desiderata",
      color: "hover:border-sky-500 hover:bg-gradient-to-br hover:from-sky-50 hover:to-blue-50/50"
    },
    {
      to: "/shift-exchange",
      icon: <Repeat className="h-6 w-6 text-violet-600" />,
      title: "Bourse aux Gardes",
      description: "Interagir avec la bourse aux gardes",
      color: "hover:border-violet-500 hover:bg-gradient-to-br hover:from-violet-50 hover:to-purple-50/50",
      disabled: true // Temporairement désactivé
    },
    {
      to: "/direct-exchange",
      icon: <Repeat className="h-6 w-6 text-orange-600" />,
      title: "Échanges",
      description: "Céder, échanger ou se faire remplacer",
      color: "hover:border-orange-500 hover:bg-gradient-to-br hover:from-orange-50 hover:to-amber-50/50",
      disabled: true // Temporairement désactivé
    }
  ];
  
  // Filtrer uniquement la carte "Échanges" tout en gardant les autres cartes désactivées visibles
  const userCards = allUserCards.filter(card => !(card.title === "Échanges"));

  // Définition de toutes les cartes administrateur
  const allAdminCards = [
    {
      to: "/admin",
      icon: <Settings className="h-6 w-6 text-indigo-600" />,
      title: "Gestion des désidérata",
      description: "Configurer les paramètres des desiderata",
      color: "hover:border-indigo-500 hover:bg-gradient-to-br hover:from-indigo-50 hover:to-blue-50/50"
    },
    {
      to: "/admin-shift-exchange",
      icon: <Repeat className="h-6 w-6 text-fuchsia-600" />,
      title: "Gestion BaG",
      description: "Gérer la bourse aux gardes",
      color: "hover:border-fuchsia-500 hover:bg-gradient-to-br hover:from-fuchsia-50 hover:to-pink-50/50",
      disabled: true // Temporairement désactivé
    },
    {
      to: "/direct-exchange",
      icon: <Repeat className="h-6 w-6 text-orange-600" />,
      title: "Échanges",
      description: "Gérer les cessions, échanges et remplacements entre médecins",
      color: "hover:border-orange-500 hover:bg-gradient-to-br hover:from-orange-50 hover:to-amber-50/50",
      disabled: true // Temporairement désactivé
    },
    {
      to: "/generated-planning",
      icon: <CalendarClock className="h-6 w-6 text-cyan-600" />,
      title: "Gestion Planning",
      description: "Importer et visualiser les plannings",
      color: "hover:border-cyan-500 hover:bg-gradient-to-br hover:from-cyan-50 hover:to-sky-50/50"
    },
    {
      to: "/validated-plannings",
      icon: <CheckSquare className="h-6 w-6 text-emerald-600" />,
      title: "Desiderata Validés",
      description: "Consulter les desiderata validés",
      color: "hover:border-emerald-500 hover:bg-gradient-to-br hover:from-emerald-50 hover:to-green-50/50"
    },
    {
      to: "/users",
      icon: <Users className="h-6 w-6 text-amber-600" />,
      title: "Utilisateurs",
      description: "Gérer les comptes utilisateurs",
      color: "hover:border-amber-500 hover:bg-gradient-to-br hover:from-amber-50 hover:to-yellow-50/50" 
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* En-tête avec logo */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 py-4 sm:py-6">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <img 
                src={LogoImage} 
                alt="PlaniDoc Logo" 
                className="h-8 w-8 sm:h-12 sm:w-12 object-contain"
              />
              <h1 className="ml-2 sm:ml-3 text-xl sm:text-3xl font-bold text-white flex items-start">
                PlaniDoc<span className="text-sm">s</span>
              </h1>
            </div>
            <Link
              to="/profile"
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-blue-700 bg-white rounded-lg hover:bg-blue-50 shadow-sm transition-all duration-200"
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
            <h1 className="text-2xl sm:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-700">
              Bienvenue, {user.firstName} <span className="text-yellow-500">👋</span>
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
              {allAdminCards.filter(card => !(card.title === "Échanges")).map((card, index) => (
                <DashboardCard key={index} {...card} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 sm:mt-12 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-100 rounded-xl p-6 flex items-start gap-4 shadow-sm hover:shadow-md transition-all">
            <HelpCircle className="h-6 w-6 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm sm:text-base font-medium text-blue-900">Besoin d'aide ?</h3>
              <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm leading-relaxed text-blue-700">
                Cliquez sur l'icône "TUTORIEL" disponible dans chaque section pour découvrir son fonctionnement.
              </p>
            </div>
          </div>
          <div className="flex-1 bg-gradient-to-br from-green-50 to-emerald-50/50 border border-green-100 rounded-xl p-6 flex items-start gap-4 shadow-sm hover:shadow-md transition-all">
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
          <div className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-100 rounded-xl p-6 flex items-start gap-4 shadow-sm hover:shadow-md transition-all">
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
