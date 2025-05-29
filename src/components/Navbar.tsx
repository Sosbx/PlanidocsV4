import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Settings, Users, LogOut, Menu, X, UserCircle, CalendarClock, Repeat, ChevronDown, RefreshCw, FileSpreadsheet, Shield, Eye } from 'lucide-react';
import { useAuth } from '../features/auth/hooks';
import { useNotifications } from '../context/notifications/NotificationContext';
import { useFeatureFlags } from '../context/featureFlags/FeatureFlagsContext';
import { useSuperAdmin } from '../context/superAdmin/SuperAdminContext';
import { FEATURES } from '../types/featureFlags';
import Logo from './common/Logo';
import NotificationBell from './common/NotificationBell';
import { Link, NavLink } from 'react-router-dom';
import { getUserInitials } from '../features/users/utils/userUtils';
import { toast } from 'react-toastify';

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

// Variable globale pour suivre les toasts récemment affichés
const navItemRecentToasts: Record<string, number> = {};

const NavItem: React.FC<NavItemProps & { disabled?: boolean }> = ({ to, icon: Icon, children, onClick, className = '', disabled }) => {
  const { getFeatureStatus } = useFeatureFlags();
  const featureKey = to.substring(1).replace(/-/g, ''); // Convertir le path en feature key
  const status = getFeatureStatus(featureKey as any);
  
  const handleDisabledClick = (e: React.MouseEvent, label?: string) => {
    e.preventDefault();
    const featureName = label || 'Cette fonctionnalité';
    
    // Vérifier si un toast pour cette fonctionnalité a été affiché récemment
    const now = Date.now();
    const lastToastTime = navItemRecentToasts[featureName] || 0;
    
    // N'afficher le toast que si aucun n'a été affiché dans les 5 dernières secondes
    if (now - lastToastTime > 5000) {
      // Message plus court
      toast.info(`${featureName} en développement`, {
        position: "top-center",
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true
      });
      
      // Enregistrer le moment où ce toast a été affiché
      navItemRecentToasts[featureName] = now;
    }
  };

  if (disabled) {
    return (
      <div
        onClick={(e) => handleDisabledClick(e, children?.toString())}
        className={`flex items-center px-2 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ease-in-out whitespace-nowrap flex-shrink-0 text-gray-400 cursor-pointer ${className}`}
        title="En développement"
      >
        <Icon className="h-4 w-4 mr-1 transition-transform duration-200" />
        {children}
        {status === 'dev' && <span className="text-xs ml-1 text-red-400">(Dev)</span>}
      </div>
    );
  }
  
  return (
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
};

// Interface pour définir un lien de navigation
interface NavLinkDefinition {
  to: string;
  icon: React.ElementType;
  label: string;
  requiredRoles: Array<'isUser' | 'isManager' | 'isAdmin' | 'isPartTime' | 'isCAT'>;
  disabled?: boolean; // Propriété pour désactiver temporairement un lien
}

const Navbar = () => {
  const { user, logout } = useAuth();
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const { isFeatureEnabled, getFeatureStatus, isSuperAdmin } = useFeatureFlags();
  const { canAccessSuperAdmin, isSuperAdminMode } = useSuperAdmin();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Définition des liens communs à tous les utilisateurs
  const commonLinks: NavLinkDefinition[] = useMemo(() => [
    { to: "/user", icon: Calendar, label: "Desiderata", requiredRoles: ['isUser', 'isManager', 'isAdmin'], disabled: getFeatureStatus(FEATURES.DESIDERATA) === 'dev' },
    { to: "/planning", icon: CalendarClock, label: "Mon Planning", requiredRoles: ['isUser', 'isManager', 'isAdmin'], disabled: getFeatureStatus(FEATURES.PLANNING) === 'dev' },
  ], [getFeatureStatus]);

  // Liens spécifiques pour le menu d'administration (uniquement pour les administrateurs)
  const adminMenuLinks: NavLinkDefinition[] = useMemo(() => [
    { to: "/admin", icon: Settings, label: "Gestion des désidérata", requiredRoles: ['isAdmin', 'isManager'], disabled: getFeatureStatus(FEATURES.ADMIN_DESIDERATA) === 'dev' },
    { to: "/users", icon: Users, label: "Utilisateurs", requiredRoles: ['isAdmin'], disabled: getFeatureStatus(FEATURES.USER_MANAGEMENT) === 'dev' },
    { to: "/generated-planning", icon: FileSpreadsheet, label: "Gestion Planning", requiredRoles: ['isAdmin'], disabled: getFeatureStatus(FEATURES.GENERATED_PLANNING) === 'dev' },
    { to: "/admin-shift-exchange", icon: Repeat, label: "Gestion BaG", requiredRoles: ['isAdmin'], disabled: getFeatureStatus(FEATURES.ADMIN_SHIFT_EXCHANGE) === 'dev' },
    { to: "/remplacements", icon: Users, label: "Remplacements", requiredRoles: ['isAdmin'], disabled: getFeatureStatus(FEATURES.REPLACEMENTS) === 'dev' },
  ], [getFeatureStatus]);

  // Liens pour les fonctionnalités en développement (communs à tous les utilisateurs)
  const devFeatureLinks: NavLinkDefinition[] = useMemo(() => [
    { to: "/shift-exchange", icon: Repeat, label: "Bourse aux Gardes", requiredRoles: ['isUser', 'isManager', 'isAdmin'], disabled: getFeatureStatus(FEATURES.SHIFT_EXCHANGE) === 'dev' },
    { to: "/direct-exchange", icon: RefreshCw, label: "Échanges", requiredRoles: ['isUser', 'isManager', 'isAdmin'], disabled: getFeatureStatus(FEATURES.DIRECT_EXCHANGE) === 'dev' },
  ], [getFeatureStatus]);

  // Déterminer les liens à afficher dans la barre de navigation principale
  const userNavLinks = useMemo(() => {
    if (!user || !user.roles) return [];
    
    // Liens de base pour tous les utilisateurs
    const links = [...commonLinks];
    
    // Ajouter les liens pour les fonctionnalités avancées
    links.push(...devFeatureLinks);
    
    // En mode super admin, afficher tous les liens sans restriction
    if (canAccessSuperAdmin && isSuperAdminMode) {
      return links.map(link => ({
        ...link,
        disabled: false // Forcer tous les liens à être actifs
      }));
    }
    
    // Sinon, filtrer les liens complètement désactivés
    return links.filter(link => {
      // Déterminer la feature associée au lien
      let featureKey;
      switch (link.to) {
        case '/user': featureKey = FEATURES.DESIDERATA; break;
        case '/planning': featureKey = FEATURES.PLANNING; break;
        case '/shift-exchange': featureKey = FEATURES.SHIFT_EXCHANGE; break;
        case '/direct-exchange': featureKey = FEATURES.DIRECT_EXCHANGE; break;
        default: return true; // Garder les liens sans feature associée
      }
      
      const status = getFeatureStatus(featureKey);
      return status !== 'disabled';
    });
  }, [user, commonLinks, devFeatureLinks, canAccessSuperAdmin, isSuperAdminMode, getFeatureStatus]);
  
  // Filtrer les liens d'administration en fonction des rôles de l'utilisateur
  const filteredAdminLinks = useMemo(() => {
    if (!user || !user.roles) return [];
    
    // En mode super admin, afficher tous les liens admin sans restriction
    if (canAccessSuperAdmin && isSuperAdminMode) {
      return adminMenuLinks.map(link => ({
        ...link,
        disabled: false // Forcer tous les liens à être actifs
      }));
    }
    
    let links = adminMenuLinks.filter(link => {
      // Vérifier si l'utilisateur a au moins un des rôles requis
      return link.requiredRoles.some(role => user.roles && user.roles[role] === true);
    });
    
    // Filtrer les liens complètement désactivés
    links = links.filter(link => {
      // Déterminer la feature associée au lien
      let featureKey;
      switch (link.to) {
        case '/admin': featureKey = FEATURES.ADMIN_DESIDERATA; break;
        case '/users': featureKey = FEATURES.USER_MANAGEMENT; break;
        case '/generated-planning': featureKey = FEATURES.GENERATED_PLANNING; break;
        case '/admin-shift-exchange': featureKey = FEATURES.ADMIN_SHIFT_EXCHANGE; break;
        case '/remplacements': featureKey = FEATURES.REPLACEMENTS; break;
        default: return true; // Garder les liens sans feature associée
      }
      
      const status = getFeatureStatus(featureKey);
      return status !== 'disabled';
    });
    
    return links;
  }, [user, adminMenuLinks, canAccessSuperAdmin, isSuperAdminMode, getFeatureStatus]);

  // Vérifier si l'utilisateur a accès au menu d'administration
  const hasAdminAccess = useMemo(() => {
    return user && user.roles && user.roles.isAdmin === true ? true : false;
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
              <NavItem key={link.to} to={link.to} icon={link.icon} disabled={link.disabled}>
                <span className="hidden md:inline">{link.label}</span>
              </NavItem>
            ))}
            
            {/* Menu d'administration pour les administrateurs */}
            {/* Lien Super Admin pour le super administrateur */}
            {canAccessSuperAdmin && (
              <NavItem to="/super-admin" icon={Shield}>
                <span className="hidden md:inline">Super Admin</span>
              </NavItem>
            )}
            
            {/* Badge Mode Incognito */}
            {canAccessSuperAdmin && !isSuperAdminMode && (
              <div className="flex items-center px-3 py-1.5 bg-orange-500 text-white rounded-full text-sm font-medium">
                <Eye className="h-4 w-4 mr-1" />
                <span className="hidden lg:inline">Mode Incognito</span>
              </div>
            )}
            
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
                  links={filteredAdminLinks}
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
                disabled={link.disabled}
              >
                <span className="inline">{link.label}</span>
              </NavItem>
            ))}
            
            {/* Lien Super Admin pour le super administrateur */}
            {canAccessSuperAdmin && (
              <NavItem 
                to="/super-admin" 
                icon={Shield} 
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="inline">Super Admin</span>
              </NavItem>
            )}
            
            {/* Badge Mode Incognito Mobile */}
            {canAccessSuperAdmin && !isSuperAdminMode && (
              <div className="mx-2 mt-2 flex items-center justify-center px-3 py-1.5 bg-orange-500 text-white rounded-full text-sm font-medium">
                <Eye className="h-4 w-4 mr-1" />
                <span>Mode Incognito</span>
              </div>
            )}
            
            {/* Section d'administration pour les administrateurs */}
            {hasAdminAccess && (
              <>
                <div className="mt-4 mb-2 px-2 text-xs font-semibold text-blue-100 uppercase tracking-wider">
                  Administration
                </div>
                {filteredAdminLinks.map(link => (
                  <NavItem 
                    key={link.to} 
                    to={link.to} 
                    icon={link.icon} 
                    onClick={() => setIsMenuOpen(false)}
                    disabled={link.disabled}
                  >
                    <span className="inline">{link.label}</span>
                  </NavItem>
                ))}
              </>
            )}
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
