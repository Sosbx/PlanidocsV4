import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { 
  Calendar, 
  RefreshCw, 
  Bell, 
  Search, 
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
import { useSuperAdmin } from '../context/superAdmin/SuperAdminContext';
import Logo from './common/Logo';
import { getUserInitials } from '../features/users/utils/userUtils';
import { motion, AnimatePresence } from 'framer-motion';

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
          <motion.div
            layoutId="activeTab"
            className="absolute inset-0 bg-white/10 rounded-xl -z-10"
            initial={false}
            transition={{ type: "spring", duration: 0.5 }}
          />
        )}
      </>
    )}
  </NavLink>
);

const ModernNavbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const { canAccessSuperAdmin, isSuperAdminMode } = useSuperAdmin();
  const location = useLocation();
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [navbarVisible, setNavbarVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
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

  const unreadCount = notifications.filter(n => !n.read).length;
  const isAdmin = user.roles?.isAdmin || user.roles?.isManager;

  // Navigation principale adaptative selon le rôle
  const mainNavItems = [
    { to: '/planning', icon: Calendar, label: 'Planning' },
    { to: '/shift-exchange', icon: Repeat, label: 'BaG' },
    { to: '/direct-exchange', icon: RefreshCw, label: 'Échanges' },
  ];

  if (user.roles?.isUser) {
    mainNavItems.unshift({ to: '/user', icon: CalendarOff, label: 'Désidérata' });
  }

  return (
    <>
      {/* Desktop Navbar - Always visible */}
      <nav className={`
        fixed top-0 left-0 right-0 z-[9999]
        bg-gradient-to-r from-blue-600 to-teal-600
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
              <button className="
                relative flex items-center justify-center
                w-9 h-9 rounded-full
                text-white hover:bg-white/10
                transition-all duration-200
              ">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="
                    absolute -top-0.5 -right-0.5
                    h-5 w-5 rounded-full
                    bg-red-500 text-white text-xs
                    flex items-center justify-center
                    animate-pulse shadow-md
                  ">
                    {unreadCount}
                  </span>
                )}
              </button>

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

                <AnimatePresence>
                  {isProfileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="
                        absolute right-0 mt-2 w-64
                        bg-white rounded-2xl shadow-xl
                        border border-gray-200
                        overflow-hidden
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
                    </motion.div>
                  )}
                </AnimatePresence>
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
      <AnimatePresence>
        {!navbarVisible && window.innerWidth < 768 && (
          <>
            {/* Spacer to prevent content from being hidden behind bottom nav */}
            <div className="h-14 md:hidden" />
            
            <motion.nav
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              transition={{ type: 'spring', damping: 25 }}
              className="
                fixed bottom-0 left-0 right-0 z-[9998]
                bg-gradient-to-r from-blue-600 to-teal-600
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
                      ? 'text-white' 
                      : 'text-white/70'
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
                className="flex flex-col items-center gap-1 p-2 rounded-lg text-white/70"
              >
                <User className="h-4 w-4" />
                <span className="text-[10px]">Profil</span>
              </button>
            </div>
          </motion.nav>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Slide Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="
                md:hidden fixed inset-0 z-50
                bg-black/50 backdrop-blur-sm
              "
            />
            
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30 }}
              className="
                md:hidden fixed right-0 top-0 bottom-0 z-50
                w-80 bg-white shadow-2xl
                overflow-y-auto
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
                      w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-teal-500
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

                {/* Admin Section */}
                {isAdmin && (
                  <div className="mt-6">
                    <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">
                      Administration
                    </div>
                    <div className="space-y-1">
                      <NavLink
                        to="/admin"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-gray-50"
                      >
                        <Settings className="h-5 w-5" />
                        <span>Gestion Désidérata</span>
                      </NavLink>
                      <NavLink
                        to="/users"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-gray-50"
                      >
                        <Users className="h-5 w-5" />
                        <span>Utilisateurs</span>
                      </NavLink>
                      <NavLink
                        to="/generated-planning"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-gray-50"
                      >
                        <FileSpreadsheet className="h-5 w-5" />
                        <span>Gestion Planning</span>
                      </NavLink>
                      <NavLink
                        to="/admin-shift-exchange"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-gray-50"
                      >
                        <Repeat className="h-5 w-5" />
                        <span>Gestion BaG</span>
                      </NavLink>
                    </div>
                  </div>
                )}

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
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Spacer for fixed navbar */}
      <div className="h-16" />
    </>
  );
};

export default ModernNavbar;