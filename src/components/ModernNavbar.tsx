import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { 
  Calendar, 
  RefreshCw, 
  Menu, 
  X, 
  Settings,
  LogOut,
  User,
  Shield,
  ChevronRight,
  CalendarOff,
  Users,
  FileSpreadsheet,
  Repeat
} from 'lucide-react';
import { useAuth } from '../features/auth/hooks';
import { useNotifications } from '../context/notifications/NotificationContext';
import NotificationBell from './common/NotificationBell';
import { useSuperAdmin } from '../context/superAdmin/SuperAdminContext';
import { useFeatureFlags } from '../context/featureFlags/FeatureFlagsContext';
import { FEATURES } from '../types/featureFlags';
import Logo from './common/Logo';
import { getUserInitials } from '../features/users/utils/userUtils';

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon: Icon, label, onClick }) => (
  <NavLink
    to={to}
    onClick={onClick}
    className={({ isActive }) => `
      relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium
      transition-all duration-200 group
      ${isActive 
        ? 'bg-white/20 text-white shadow-md backdrop-blur-sm' 
        : 'text-white/80 hover:text-white hover:bg-white/10'
      }
    `}
  >
    {({ isActive }) => (
      <>
        <Icon className={`h-5 w-5 transition-transform group-hover:scale-110`} />
        <span className="text-xs whitespace-nowrap">{label}</span>
        {isActive && (
          <div className="absolute inset-0 bg-white/10 rounded-xl -z-10 transition-all duration-300" />
        )}
      </>
    )}
  </NavLink>
);

const ModernNavbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const { canAccessSuperAdmin, isSuperAdminMode } = useSuperAdmin();
  const { getFeatureStatus } = useFeatureFlags();
  const _location = useLocation();
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [navbarVisible, setNavbarVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [_isMobile, _setIsMobile] = useState(false);
  
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      _setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // On mobile, hide navbar on scroll down, show on scroll up
      if (window.innerWidth < 768) {
        if (currentScrollY > lastScrollY && currentScrollY > 80) {
          setNavbarVisible(false);
        } else {
          setNavbarVisible(true);
        }
      }
      
      setLastScrollY(currentScrollY);
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [lastScrollY]);

  if (!user) return null;

  const _unreadCount = notifications.filter(n => !n.read).length;
  const isAdmin = user.roles?.isAdmin || user.roles?.isManager;
  const isOnlyAdmin = isAdmin && !user.roles?.isUser;

  // Navigation principale adaptative selon le rôle
  let mainNavItems = [];
  
  if (isOnlyAdmin) {
    // Si uniquement admin, afficher les pages d'administration
    const adminItems = [
      { to: '/admin', icon: Settings, label: 'Gestion Désidérata', feature: FEATURES.ADMIN_DESIDERATA },
      { to: '/users', icon: Users, label: 'Utilisateurs', feature: FEATURES.USER_MANAGEMENT },
      { to: '/generated-planning', icon: FileSpreadsheet, label: 'Planning', feature: FEATURES.GENERATED_PLANNING },
      { to: '/admin-shift-exchange', icon: Repeat, label: 'Gestion BaG', feature: FEATURES.ADMIN_SHIFT_EXCHANGE },
      { to: '/remplacements', icon: Users, label: 'Remplacements', feature: FEATURES.REPLACEMENTS },
    ];
    
    // Filtrer selon les feature flags sauf en mode super admin
    mainNavItems = adminItems.filter(item => {
      const status = getFeatureStatus(item.feature);
      // En mode super admin, afficher tous les items
      if (canAccessSuperAdmin && isSuperAdminMode) return true;
      // Sinon, cacher les items désactivés ET en dev
      return status !== 'disabled' && status !== 'dev';
    });
  } else {
    // Sinon, afficher les pages utilisateur normales
    const userItems = [
      { to: '/planning', icon: Calendar, label: 'Planning', feature: FEATURES.PLANNING },
      { to: '/direct-exchange', icon: RefreshCw, label: 'Échanges', feature: FEATURES.DIRECT_EXCHANGE },
      { to: '/shift-exchange', icon: Repeat, label: 'BaG', feature: FEATURES.SHIFT_EXCHANGE },
      { to: '/user', icon: CalendarOff, label: 'Désidérata', feature: FEATURES.DESIDERATA },
    ];
    
    // Filtrer selon les feature flags sauf en mode super admin
    mainNavItems = userItems.filter(item => {
      const status = getFeatureStatus(item.feature);
      // En mode super admin, afficher tous les items
      if (canAccessSuperAdmin && isSuperAdminMode) return true;
      // Sinon, cacher les items désactivés ET en dev
      return status !== 'disabled' && status !== 'dev';
    });
  }

  return (
    <>
      {/* Desktop Navbar - Always visible */}
      <nav className={`
        fixed top-0 left-0 right-0 z-[9999]
        bg-gradient-to-r from-blue-600 to-blue-500
        backdrop-blur-md shadow-lg
        transition-transform duration-300
        ${navbarVisible || window.innerWidth >= 768 ? 'translate-y-0' : '-translate-y-full'}
      `}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/dashboard" className="flex-shrink-0 hover:scale-105 transition-transform">
                <Logo showText={true} className="h-8" />
              </Link>
            </div>

            {/* Center Navigation - Desktop */}
            <div className="hidden md:flex items-center gap-2">
              {mainNavItems.map(item => (
                <NavItem key={item.to} {...item} />
              ))}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              {/* Notifications */}
              <NotificationBell
                notifications={notifications}
                onMarkAsRead={markAsRead}
                onMarkAllAsRead={markAllAsRead}
              />

              {/* Profile Menu - Desktop only */}
              <div className="hidden md:block relative" ref={profileRef}>
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="
                    flex items-center gap-2 px-2 py-1.5 rounded-full
                    hover:bg-white/10 transition-all duration-200
                  "
                >
                  <div className="
                    w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm
                    flex items-center justify-center text-white text-sm font-medium
                    shadow-md
                  ">
                    {getUserInitials(user)}
                  </div>
                  <ChevronRight className={`
                    h-4 w-4 text-white/80 transition-transform
                    ${isProfileOpen ? 'rotate-90' : ''}
                  `} />
                </button>

                {isProfileOpen && (
                  <div className="
                    absolute right-0 mt-2 w-64
                    bg-white rounded-2xl shadow-xl
                    border border-gray-200
                    overflow-hidden
                    animate-slide-down
                  "
                    >
                      {/* User Info */}
                      <div className="p-4 border-b border-gray-100">
                        <div className="font-medium text-gray-900">{user.displayName}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                        {isSuperAdminMode && (
                          <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-orange-400 to-red-400 text-white rounded-full text-xs shadow-md">
                            <Shield className="h-3 w-3" />
                            Mode Super Admin
                          </div>
                        )}
                      </div>

                      {/* Quick Links */}
                      <div className="py-2">
                        <Link
                          to="/profile"
                          onClick={() => setIsProfileOpen(false)}
                          className="
                            flex items-center gap-3 px-4 py-2
                            text-gray-700 hover:bg-gray-50
                            transition-colors
                          "
                        >
                          <User className="h-4 w-4" />
                          Mon Profil
                        </Link>

                        {/* Admin Links for all admins */}
                        {isAdmin && (() => {
                          const adminLinks = [];
                          
                          // Vérifier chaque feature flag sauf en mode super admin
                          const adminDesiderataStatus = getFeatureStatus(FEATURES.ADMIN_DESIDERATA);
                          if ((canAccessSuperAdmin && isSuperAdminMode) || (adminDesiderataStatus !== 'disabled' && adminDesiderataStatus !== 'dev')) {
                            adminLinks.push(
                              <Link
                                key="admin"
                                to="/admin"
                                onClick={() => setIsProfileOpen(false)}
                                className="
                                  flex items-center gap-3 px-4 py-2
                                  text-gray-700 hover:bg-gray-50
                                  transition-colors
                                "
                              >
                                <Settings className="h-4 w-4" />
                                Gestion Désidérata
                              </Link>
                            );
                          }
                          
                          const userManagementStatus = getFeatureStatus(FEATURES.USER_MANAGEMENT);
                          if ((canAccessSuperAdmin && isSuperAdminMode) || (userManagementStatus !== 'disabled' && userManagementStatus !== 'dev')) {
                            adminLinks.push(
                              <Link
                                key="users"
                                to="/users"
                                onClick={() => setIsProfileOpen(false)}
                                className="
                                  flex items-center gap-3 px-4 py-2
                                  text-gray-700 hover:bg-gray-50
                                  transition-colors
                                "
                              >
                                <Users className="h-4 w-4" />
                                Utilisateurs
                              </Link>
                            );
                          }
                          
                          const generatedPlanningStatus = getFeatureStatus(FEATURES.GENERATED_PLANNING);
                          if ((canAccessSuperAdmin && isSuperAdminMode) || (generatedPlanningStatus !== 'disabled' && generatedPlanningStatus !== 'dev')) {
                            adminLinks.push(
                              <Link
                                key="generated-planning"
                                to="/generated-planning"
                                onClick={() => setIsProfileOpen(false)}
                                className="
                                  flex items-center gap-3 px-4 py-2
                                  text-gray-700 hover:bg-gray-50
                                  transition-colors
                                "
                              >
                                <FileSpreadsheet className="h-4 w-4" />
                                Gestion Planning
                              </Link>
                            );
                          }
                          
                          const adminShiftExchangeStatus = getFeatureStatus(FEATURES.ADMIN_SHIFT_EXCHANGE);
                          if ((canAccessSuperAdmin && isSuperAdminMode) || (adminShiftExchangeStatus !== 'disabled' && adminShiftExchangeStatus !== 'dev')) {
                            adminLinks.push(
                              <Link
                                key="admin-shift-exchange"
                                to="/admin-shift-exchange"
                                onClick={() => setIsProfileOpen(false)}
                                className="
                                  flex items-center gap-3 px-4 py-2
                                  text-gray-700 hover:bg-gray-50
                                  transition-colors
                                "
                              >
                                <Repeat className="h-4 w-4" />
                                Gestion BaG
                              </Link>
                            );
                          }
                          
                          const replacementsStatus = getFeatureStatus(FEATURES.REPLACEMENTS);
                          if ((canAccessSuperAdmin && isSuperAdminMode) || (replacementsStatus !== 'disabled' && replacementsStatus !== 'dev')) {
                            adminLinks.push(
                              <Link
                                key="remplacements"
                                to="/remplacements"
                                onClick={() => setIsProfileOpen(false)}
                                className="
                                  flex items-center gap-3 px-4 py-2
                                  text-gray-700 hover:bg-gray-50
                                  transition-colors
                                "
                              >
                                <Users className="h-4 w-4" />
                                Remplacements
                              </Link>
                            );
                          }
                          
                          // Afficher la section seulement s'il y a des liens
                          if (adminLinks.length > 0) {
                            return (
                              <>
                                <div className="my-2 border-t border-gray-100" />
                                <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">
                                  Administration
                                </div>
                                {adminLinks}
                              </>
                            );
                          }
                          
                          return null;
                        })()}

                        {canAccessSuperAdmin && (
                          <>
                            <div className="my-2 border-t border-gray-100" />
                            <Link
                              to="/super-admin"
                              onClick={() => setIsProfileOpen(false)}
                              className="
                                flex items-center gap-3 px-4 py-2
                                text-gray-700 hover:bg-gray-50
                                transition-colors
                              "
                            >
                              <Shield className="h-4 w-4" />
                              Super Admin
                            </Link>
                          </>
                        )}

                        <div className="my-2 border-t border-gray-100" />
                        
                        <button
                          onClick={() => {
                            setIsProfileOpen(false);
                            logout();
                          }}
                          className="
                            w-full flex items-center gap-3 px-4 py-2
                            text-red-600 hover:bg-red-50
                            transition-colors
                          "
                        >
                          <LogOut className="h-4 w-4" />
                          Se déconnecter
                        </button>
                      </div>
                  </div>
                )}
              </div>

              {/* Mobile Menu Toggle - Same as profile button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="
                  md:hidden flex items-center gap-2 px-2 py-1.5 rounded-full
                  hover:bg-white/10 transition-all duration-200
                "
              >
                <div className="
                  w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm
                  flex items-center justify-center text-white text-sm font-medium
                  shadow-md
                ">
                  {getUserInitials(user)}
                </div>
                <ChevronRight className={`
                  h-4 w-4 text-white/80 transition-transform
                  ${isMobileMenuOpen ? 'rotate-90' : ''}
                `} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation - Only show when navbar is hidden */}
      {!navbarVisible && window.innerWidth < 768 && (
          <>
            {/* Spacer to prevent content from being hidden behind bottom nav */}
            <div className="h-14 md:hidden" />
            
            <nav className="
              fixed bottom-0 left-0 right-0 z-[9998]
              bg-white/95 backdrop-blur-sm
              border-t border-gray-200/50
              shadow-lg md:hidden
            "
            >
            <div className="flex items-center justify-around h-14 px-2">
              {mainNavItems.slice(0, 4).map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `
                    flex flex-col items-center gap-1 p-2 rounded-lg
                    transition-all duration-200
                    ${isActive 
                      ? 'text-blue-600' 
                      : 'text-gray-600'
                    }
                  `}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className={`h-4 w-4 ${isActive ? 'scale-110' : ''}`} />
                      <span className="text-[10px]">{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
              
              <button
                onClick={() => {
                  setIsMobileMenuOpen(true);
                  setNavbarVisible(true);
                }}
                className="flex flex-col items-center gap-1 p-2 rounded-lg text-gray-600"
              >
                <Menu className="h-4 w-4" />
                <span className="text-[10px]">Menu</span>
              </button>
            </div>
          </nav>
        </>
      )}

      {/* Mobile Slide Menu */}
      {isMobileMenuOpen && (
          <>
            <div
              onClick={() => setIsMobileMenuOpen(false)}
              className="
                md:hidden fixed inset-0 z-50
                bg-black/50 backdrop-blur-sm animate-fade-in
              "
            />
            
            <div className="
              md:hidden fixed right-0 top-0 bottom-0 z-50
              w-80 bg-white shadow-2xl
              overflow-y-auto animate-slide-in-right
            "
            >
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Mon compte</h2>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 rounded-full hover:bg-gray-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="p-4">
                {/* User Info */}
                <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="
                      w-12 h-12 rounded-full bg-blue-600
                      flex items-center justify-center text-white font-medium shadow-md
                    ">
                      {getUserInitials(user)}
                    </div>
                    <div>
                      <div className="font-medium">{user.displayName}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </div>

                {/* Navigation */}
                <div className="space-y-1">
                  <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">
                    Navigation
                  </div>
                  {mainNavItems.map(item => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={({ isActive }) => `
                        flex items-center gap-3 px-4 py-3 rounded-xl
                        transition-all duration-200
                        ${isActive 
                          ? 'bg-blue-50 text-blue-600' 
                          : 'text-gray-700 hover:bg-gray-50'
                        }
                      `}
                    >
                      <item.icon className="h-5 w-5" />
                      <span className="font-medium">{item.label}</span>
                    </NavLink>
                  ))}
                </div>

                {/* Admin Section - only show items not already in mainNavItems */}
                {isAdmin && !isOnlyAdmin && (() => {
                  const adminLinks = [];
                  
                  // Create a set of main nav paths for quick lookup
                  const mainNavPaths = new Set(mainNavItems.map(item => item.to));
                  
                  // Check each admin link
                  const adminDesiderataStatus = getFeatureStatus(FEATURES.ADMIN_DESIDERATA);
                  if (!mainNavPaths.has('/admin') && ((canAccessSuperAdmin && isSuperAdminMode) || (adminDesiderataStatus !== 'disabled' && adminDesiderataStatus !== 'dev'))) {
                    adminLinks.push(
                      <NavLink
                        key="admin"
                        to="/admin"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={({ isActive }) => `
                          flex items-center gap-3 px-4 py-3 rounded-xl
                          transition-all duration-200
                          ${isActive 
                            ? 'bg-blue-50 text-blue-600' 
                            : 'text-gray-700 hover:bg-gray-50'
                          }
                        `}
                      >
                        <Settings className="h-5 w-5" />
                        <span>Gestion Désidérata</span>
                      </NavLink>
                    );
                  }
                  
                  const userManagementStatus = getFeatureStatus(FEATURES.USER_MANAGEMENT);
                  if (!mainNavPaths.has('/users') && ((canAccessSuperAdmin && isSuperAdminMode) || (userManagementStatus !== 'disabled' && userManagementStatus !== 'dev'))) {
                    adminLinks.push(
                      <NavLink
                        key="users"
                        to="/users"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={({ isActive }) => `
                          flex items-center gap-3 px-4 py-3 rounded-xl
                          transition-all duration-200
                          ${isActive 
                            ? 'bg-blue-50 text-blue-600' 
                            : 'text-gray-700 hover:bg-gray-50'
                          }
                        `}
                      >
                        <Users className="h-5 w-5" />
                        <span>Utilisateurs</span>
                      </NavLink>
                    );
                  }
                  
                  const generatedPlanningStatus = getFeatureStatus(FEATURES.GENERATED_PLANNING);
                  if (!mainNavPaths.has('/generated-planning') && ((canAccessSuperAdmin && isSuperAdminMode) || (generatedPlanningStatus !== 'disabled' && generatedPlanningStatus !== 'dev'))) {
                    adminLinks.push(
                      <NavLink
                        key="generated-planning"
                        to="/generated-planning"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={({ isActive }) => `
                          flex items-center gap-3 px-4 py-3 rounded-xl
                          transition-all duration-200
                          ${isActive 
                            ? 'bg-blue-50 text-blue-600' 
                            : 'text-gray-700 hover:bg-gray-50'
                          }
                        `}
                      >
                        <FileSpreadsheet className="h-5 w-5" />
                        <span>Gestion Planning</span>
                      </NavLink>
                    );
                  }
                  
                  const adminShiftExchangeStatus = getFeatureStatus(FEATURES.ADMIN_SHIFT_EXCHANGE);
                  if (!mainNavPaths.has('/admin-shift-exchange') && ((canAccessSuperAdmin && isSuperAdminMode) || (adminShiftExchangeStatus !== 'disabled' && adminShiftExchangeStatus !== 'dev'))) {
                    adminLinks.push(
                      <NavLink
                        key="admin-shift-exchange"
                        to="/admin-shift-exchange"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={({ isActive }) => `
                          flex items-center gap-3 px-4 py-3 rounded-xl
                          transition-all duration-200
                          ${isActive 
                            ? 'bg-blue-50 text-blue-600' 
                            : 'text-gray-700 hover:bg-gray-50'
                          }
                        `}
                      >
                        <Repeat className="h-5 w-5" />
                        <span>Gestion BaG</span>
                      </NavLink>
                    );
                  }
                  
                  const replacementsStatus = getFeatureStatus(FEATURES.REPLACEMENTS);
                  if (!mainNavPaths.has('/remplacements') && ((canAccessSuperAdmin && isSuperAdminMode) || (replacementsStatus !== 'disabled' && replacementsStatus !== 'dev'))) {
                    adminLinks.push(
                      <NavLink
                        key="remplacements"
                        to="/remplacements"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={({ isActive }) => `
                          flex items-center gap-3 px-4 py-3 rounded-xl
                          transition-all duration-200
                          ${isActive 
                            ? 'bg-blue-50 text-blue-600' 
                            : 'text-gray-700 hover:bg-gray-50'
                          }
                        `}
                      >
                        <Users className="h-5 w-5" />
                        <span>Remplacements</span>
                      </NavLink>
                    );
                  }
                  
                  // Only show the section if there are links
                  if (adminLinks.length > 0) {
                    return (
                      <div className="mt-6">
                        <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">
                          Administration
                        </div>
                        <div className="space-y-1">
                          {adminLinks}
                        </div>
                      </div>
                    );
                  }
                  
                  return null;
                })()}

                {/* Actions */}
                <div className="mt-6 pt-6 border-t border-gray-200 space-y-2">
                  <Link
                    to="/profile"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-gray-50"
                  >
                    <User className="h-5 w-5" />
                    <span>Mon Profil</span>
                  </Link>
                  
                  {canAccessSuperAdmin && (
                    <Link
                      to="/super-admin"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-gray-50"
                    >
                      <Shield className="h-5 w-5" />
                      <span>Super Admin</span>
                    </Link>
                  )}
                  
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-5 w-5" />
                    <span>Se déconnecter</span>
                  </button>
                </div>
              </div>
            </div>
        </>
      )}

      {/* Spacer for fixed navbar */}
      <div className="h-16" />
    </>
  );
};

export default ModernNavbar;