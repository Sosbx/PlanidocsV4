import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Settings, Users, LogOut, Menu, X, UserCircle, CheckSquare, CalendarClock, Repeat, LayoutDashboard, ChevronDown, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '../features/auth/hooks';
import { useNotifications } from '../context/notifications/NotificationContext';
import Logo from './common/Logo';
import NotificationBell from './common/NotificationBell';
import { Link, NavLink } from 'react-router-dom';
import { getUserInitials } from '../features/users/utils/userUtils';

interface AdminMenuItemProps {
  to: string;
  icon: React.ElementType;
  children: React.ReactNode;
  onClick: () => void;
}

const AdminMenuItem: React.FC<AdminMenuItemProps> = ({ to, icon: Icon, children, onClick }) => (
  <NavLink
    to={to}
    className={({ isActive }) => `${
      isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
    } flex items-center px-4 py-2 text-sm hover:bg-gray-100 transition-colors`}
    onClick={onClick}
  >
    <Icon className="h-4 w-4 mr-3" />
    {children}
  </NavLink>
);

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

interface AdminMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdminMenu: React.FC<AdminMenuProps & { links: NavLinkDefinition[] }> = ({ isOpen, onClose, links }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed right-2 top-14 mt-1 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-[100] overflow-auto max-h-80">
      <div className="py-1" role="menu">
        {links.map(link => (
          <AdminMenuItem
            key={link.to}
            to={link.to}
            icon={link.icon}
            onClick={onClose}
          >
            {link.label}
          </AdminMenuItem>
        ))}
      </div>
    </div>
  );
};

const NavItem: React.FC<NavItemProps> = ({ to, icon: Icon, children, onClick, className = '' }) => (
  <NavLink
    to={to}
    onClick={onClick}
    className={({ isActive }) => 
      `flex items-center px-2 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ease-in-out whitespace-nowrap flex-shrink-0 ${
        isActive
          ? 'bg-white text-blue-600 shadow-md transform scale-105'
          : 'text-blue-50 hover:bg-blue-500/50 hover:text-white'
      } ${className}`
    }
  >
    <Icon className="h-4 w-4 mr-1 transition-transform duration-200" />
    {children}
  </NavLink>
);

// Interface pour définir un lien de navigation
interface NavLinkDefinition {
  to: string;
  icon: React.ElementType;
  label: string;
  requiredRoles: Array<'isUser' | 'isManager' | 'isAdmin' | 'isPartTime' | 'isCAT'>;
}

const Navbar = () => {
  const { user, logout } = useAuth();
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Définition des liens par rôle spécifique (sans chevauchement)
  const navLinksByRole: Record<string, NavLinkDefinition[]> = useMemo(() => ({
    // Liens pour les utilisateurs standards
    isUser: [
      { to: "/planning", icon: CalendarClock, label: "Planning", requiredRoles: ['isUser'] },
      { to: "/user", icon: Calendar, label: "Desiderata", requiredRoles: ['isUser'] },
      { to: "/shift-exchange", icon: Repeat, label: "BaG", requiredRoles: ['isUser'] },
      { to: "/direct-exchange", icon: RefreshCw, label: "Échanges Directs", requiredRoles: ['isUser'] },
    ],
    
    // Liens pour les managers (incluant les fonctionnalités utilisateur + spécifiques manager)
    isManager: [
      { to: "/planning", icon: CalendarClock, label: "Planning", requiredRoles: ['isManager'] },
      { to: "/user", icon: Calendar, label: "Desiderata", requiredRoles: ['isManager'] },
      { to: "/shift-exchange", icon: Repeat, label: "BaG", requiredRoles: ['isManager'] },
      { to: "/direct-exchange", icon: RefreshCw, label: "Échanges Directs", requiredRoles: ['isManager'] },
      { to: "/admin", icon: Settings, label: "Configuration", requiredRoles: ['isManager'] },
    ],
    
    // Liens pour les administrateurs (uniquement les liens principaux, le reste est dans le menu admin)
    isAdmin: [
      { to: "/planning", icon: CalendarClock, label: "Planning", requiredRoles: ['isAdmin'] },
      { to: "/user", icon: Calendar, label: "Desiderata", requiredRoles: ['isAdmin'] },
      { to: "/shift-exchange", icon: Repeat, label: "BaG", requiredRoles: ['isAdmin'] },
      { to: "/direct-exchange", icon: RefreshCw, label: "Échanges Directs", requiredRoles: ['isAdmin'] },
    ],
  }), []);

  // Liens spécifiques pour le menu d'administration (uniquement pour les administrateurs)
  const adminMenuLinks: NavLinkDefinition[] = useMemo(() => [
    { to: "/admin", icon: Settings, label: "Configuration", requiredRoles: ['isAdmin'] },
    { to: "/users", icon: Users, label: "Utilisateurs", requiredRoles: ['isAdmin'] },
    { to: "/generated-planning", icon: FileSpreadsheet, label: "Gestion Planning", requiredRoles: ['isAdmin'] },
    { to: "/validated-plannings", icon: CheckSquare, label: "Validés", requiredRoles: ['isAdmin'] },
    { to: "/admin-shift-exchange", icon: Repeat, label: "Gestion BaG", requiredRoles: ['isAdmin'] },
    { to: "/remplacements", icon: Users, label: "Remplacements", requiredRoles: ['isAdmin'] },
  ], []);

  // Déterminer les liens à afficher en fonction de la hiérarchie des rôles
  const userNavLinks = useMemo(() => {
    if (!user || !user.roles) return [];
    
    // Vérifier les rôles dans l'ordre de priorité
    if (user.roles.isAdmin) {
      return navLinksByRole.isAdmin;
    } else if (user.roles.isManager) {
      return navLinksByRole.isManager;
    } else if (user.roles.isUser) {
      return navLinksByRole.isUser;
    }
    
    // Si aucun rôle trouvé, retourner un tableau vide
    return [];
  }, [user, navLinksByRole]);

  // Vérifier si l'utilisateur a accès au menu d'administration
  const hasAdminAccess = useMemo(() => {
    return user?.roles?.isAdmin || false;
  }, [user]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!user) return null;

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  
  return (
    <nav className={`bg-gradient-to-r from-blue-600 to-blue-700 text-white sticky top-0 z-50 backdrop-blur-sm transition-all duration-200 w-full ${
      isScrolled ? 'shadow-lg bg-opacity-95' : 'bg-opacity-100'
    }`}>
      <div className="max-w-7xl mx-auto px-2 sm:px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex-shrink-0">
            <Link to="/dashboard">
              <Logo showText={true} className="h-8 transition-transform duration-200 hover:scale-105" />
            </Link>
          </div>
          
          <div className="md:hidden flex items-center gap-2">
            <NotificationBell 
              notifications={notifications}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
            />
            <button
              onClick={toggleMenu}
              className="inline-flex items-center justify-center p-2 rounded-full text-blue-100 hover:bg-blue-500/50 transition-all duration-200 hover:scale-105"
              aria-label="Menu principal"
            >
              {isMenuOpen ? (
                <X className="h-6 w-6 transform transition-transform duration-200 rotate-90" />
              ) : (
                <Menu className="h-6 w-6 transform transition-transform duration-200" />
              )}
            </button>
          </div>

          <div className="hidden md:flex items-center space-x-1 lg:space-x-2 overflow-x-auto no-scrollbar">
            {/* Afficher les liens de navigation filtrés */}
            {userNavLinks.map(link => (
              <NavItem key={link.to} to={link.to} icon={link.icon}>
                <span className="hidden md:inline">{link.label}</span>
              </NavItem>
            ))}
            
            {/* Menu d'administration pour les administrateurs */}
            {hasAdminAccess && (
              <div className="relative inline-block flex-shrink-0">
                {/* Overlay pour fermer le menu en cliquant en dehors - déplacé après le bouton */}
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Empêcher la propagation de l'événement
                    console.log("État actuel:", isAdminMenuOpen);
                    setIsAdminMenuOpen(!isAdminMenuOpen);
                    console.log("Nouvel état:", !isAdminMenuOpen);
                  }}
                  className={`flex items-center px-2 py-1.5 rounded-full text-sm font-medium transition-all duration-200 z-[100] relative ${
                    isAdminMenuOpen 
                      ? 'bg-white text-blue-600 shadow-md'
                      : 'text-blue-50 hover:bg-blue-500/50 hover:text-white'
                  }`}
                >
                  <Settings className="h-4 w-4" />
                  <span className="hidden xl:inline ml-2">Admin</span>
                  <ChevronDown className={`h-4 w-4 ml-1 transform transition-transform duration-200 ${isAdminMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {/* Pas d'overlay pour l'instant pour résoudre le problème */}
                
                <AdminMenu 
                  isOpen={isAdminMenuOpen} 
                  onClose={() => setIsAdminMenuOpen(false)}
                  links={adminMenuLinks}
                />
              </div>
            )}
            <NotificationBell 
              notifications={notifications}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
              className="flex-shrink-0"
            />
            <Link
              to="/profile"
              data-tutorial="profile-link"
              className="flex items-center text-blue-50 hover:text-white gap-1 px-2 py-1.5 rounded-full hover:bg-blue-500/50 transition-all duration-200 flex-shrink-0"
            >
              <UserCircle className="h-5 w-5" />
              <span className="hidden md:inline">{getUserInitials(user)}</span>
            </Link>
            <button
              onClick={logout}
              className="flex items-center px-2 py-1.5 rounded-full text-blue-50 hover:bg-blue-500/50 hover:text-white transition-all duration-200 flex-shrink-0"
              title="Se déconnecter"
            > 
              <LogOut className="h-5 w-5" />
              <span className="hidden xl:inline ml-1">Déconnecter</span>
            </button>
          </div>
        </div>

        <div
          className={`md:hidden overflow-y-auto transition-all duration-300 ease-in-out border-t border-blue-500/30 ${
            isMenuOpen ? 'max-h-[calc(100vh-4rem)] opacity-100 pb-4' : 'max-h-0 opacity-0'
          }`}
          style={{ scrollbarWidth: 'thin' }}
        >
          <div className="py-3 space-y-1 px-2">
            {/* Afficher les liens de navigation filtrés */}
            {userNavLinks.map(link => (
              <NavItem 
                key={link.to} 
                to={link.to} 
                icon={link.icon} 
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="inline">{link.label}</span>
              </NavItem>
            ))}
            
            {/* Liens d'administration pour les administrateurs */}
            {hasAdminAccess && adminMenuLinks.map(link => (
              <NavItem 
                key={link.to} 
                to={link.to} 
                icon={link.icon} 
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="inline">{link.label}</span>
              </NavItem>
            ))}
            <button
              onClick={() => {
                setIsMenuOpen(false);
                logout();
              }}
              className="flex items-center p-2 rounded-full text-blue-50 hover:bg-blue-500/50 hover:text-white transition-all duration-200"
              title="Se déconnecter"
            > 
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
