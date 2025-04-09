import React, { useState, useEffect } from 'react';
import { Calendar, Settings, Users, LogOut, Menu, X, UserCircle, CheckSquare, CalendarClock, Repeat, LayoutDashboard, ChevronDown, Bell } from 'lucide-react';
import { useAuth } from '../features/auth/hooks';
import { useNotifications } from '../context/NotificationContext';
import Logo from './common/Logo';
import NotificationBell from './common/NotificationBell';
import { Link, NavLink } from 'react-router-dom';
import { getUserInitials } from '../utils/userUtils';

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

const AdminMenu: React.FC<AdminMenuProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="absolute right-0 top-full mt-1 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-[60]">
      <div className="py-1" role="menu">
        <AdminMenuItem
          to="/admin"
          icon={Settings}
          onClick={onClose}
        >
          Configuration
        </AdminMenuItem>
        <AdminMenuItem
          to="/users"
          icon={Users}
          onClick={onClose}
        >
          Utilisateurs
        </AdminMenuItem>
        <AdminMenuItem
          to="/generated-planning"
          icon={CalendarClock}
          onClick={onClose}
        >
          Gestion Planning
        </AdminMenuItem>
        <AdminMenuItem
          to="/validated-plannings"
          icon={CheckSquare}
          onClick={onClose}
        >
          Validés
        </AdminMenuItem>
        <AdminMenuItem
          to="/admin-shift-exchange"
          icon={Repeat}
          onClick={onClose}
        >
          Gestion BaG
        </AdminMenuItem>
        <AdminMenuItem
          to="/remplacements"
          icon={Users}
          onClick={onClose}
        >
          Remplacements
        </AdminMenuItem>
      </div>
    </div>
  );
};

const NavItem: React.FC<NavItemProps> = ({ to, icon: Icon, children, onClick, className = '' }) => (
  <NavLink
    to={to}
    onClick={onClick}
    className={({ isActive }) => 
      `flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ease-in-out ${
        isActive
          ? 'bg-white text-blue-600 shadow-md transform scale-105'
          : 'text-blue-50 hover:bg-blue-500/50 hover:text-white'
      } ${className}`
    }
  >
    <Icon className="h-4 w-4 mr-2 transition-transform duration-200" />
    {children}
  </NavLink>
);

const Navbar = () => {
  const { user, logout } = useAuth();
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

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
    <nav className={`bg-gradient-to-r from-blue-600 to-blue-700 text-white sticky top-0 z-50 backdrop-blur-sm transition-all duration-200 ${
      isScrolled ? 'shadow-lg bg-opacity-95' : 'bg-opacity-100'
    }`}>
      <div className="max-w-7xl mx-auto px-2 sm:px-4">
        <div className="flex items-center justify-between h-16">
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

          <div className="hidden md:flex items-center space-x-1 lg:space-x-2">
            <NavItem to="/dashboard" icon={LayoutDashboard}>
              <span className="hidden lg:inline">Tableau de bord</span>
            </NavItem>
            {user.roles.isUser && (
              <>
                <NavItem to="/planning" icon={CalendarClock}>
                  <span className="hidden lg:inline">Planning</span>
                </NavItem> 
                <NavItem to="/user" icon={Calendar}>
                  <span className="hidden lg:inline">Desiderata</span>
                </NavItem>
                <NavItem to="/shift-exchange" icon={Repeat}>
                  <span className="hidden lg:inline">BaG</span>
                </NavItem>
                <NavItem to="/direct-exchange" icon={Repeat}>
                  <span className="hidden lg:inline">Échanges Directs</span>
                </NavItem>
              </>
            )}
            {user.roles.isManager && ( 
              <>
                <NavItem to="/admin" icon={Settings}>
                  <span className="hidden lg:inline">Configuration</span>
                </NavItem>
                <NavItem to="/planning" icon={CalendarClock}>
                  <span className="hidden lg:inline">Planning</span>
                </NavItem>
                <NavItem to="/shift-exchange" icon={Repeat}>
                  <span className="hidden lg:inline">BaG</span>
                </NavItem>
                <NavItem to="/direct-exchange" icon={Repeat}>
                  <span className="hidden lg:inline">Échanges Directs</span>
                </NavItem>
              </>
            )}
            {user.roles.isAdmin && ( 
              <>
                <div className="relative inline-block">
                  {/* Overlay pour fermer le menu en cliquant en dehors */}
                  {isAdminMenuOpen && (
                    <div 
                      className="fixed inset-0 z-[55]"
                      onClick={() => setIsAdminMenuOpen(false)}
                    />
                  )}
                  <button
                    onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)}
                    className={`flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                      isAdminMenuOpen 
                        ? 'bg-white text-blue-600 shadow-md'
                        : 'text-blue-50 hover:bg-blue-500/50 hover:text-white'
                    }`}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    <span>Administration</span>
                    <ChevronDown className={`h-4 w-4 ml-2 transform transition-transform duration-200 ${isAdminMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AdminMenu 
                    isOpen={isAdminMenuOpen} 
                    onClose={() => setIsAdminMenuOpen(false)} 
                  />
                </div>
              </>
            )}
            <NotificationBell 
              notifications={notifications}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
            />
            <Link
              to="/profile"
              data-tutorial="profile-link"
              className="flex items-center text-blue-50 hover:text-white gap-2 px-3 py-1.5 rounded-full hover:bg-blue-500/50 transition-all duration-200 whitespace-nowrap"
            >
              <UserCircle className="h-5 w-5" />
              <span className="hidden md:inline lg:hidden">{getUserInitials(user)}</span>
              <span className="hidden lg:inline">{user.firstName} {user.lastName}</span>
            </Link>
            <button
              onClick={logout}
              className="p-2 rounded-full text-blue-50 hover:bg-blue-500/50 hover:text-white transition-all duration-200"
              title="Se déconnecter"
            > 
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div
          className={`md:hidden overflow-y-auto transition-all duration-300 ease-in-out border-t border-blue-500/30 ${
            isMenuOpen ? 'max-h-[calc(100vh-4rem)] opacity-100' : 'max-h-0 opacity-0'
          }`}
          style={{ scrollbarWidth: 'thin' }}
        >
          <div className="py-3 space-y-1">
            <NavItem to="/dashboard" icon={LayoutDashboard} onClick={() => setIsMenuOpen(false)}>
              <span className="inline">Tableau de bord</span>
            </NavItem> 
            {user.roles.isUser && (
              <>
                <NavItem to="/planning" icon={CalendarClock} onClick={() => setIsMenuOpen(false)}>
                  <span className="inline">Planning</span>
                </NavItem>
                <NavItem to="/user" icon={Calendar} onClick={() => setIsMenuOpen(false)}>
                  <span className="inline">Desiderata</span>
                </NavItem>
                <NavItem to="/shift-exchange" icon={Repeat} onClick={() => setIsMenuOpen(false)}>
                  <span className="inline">BaG</span>
                </NavItem>
                <NavItem to="/direct-exchange" icon={Repeat} onClick={() => setIsMenuOpen(false)}>
                  <span className="inline">Échanges Directs</span>
                </NavItem>
              </>
            )}
            {user.roles.isManager && ( 
              <>
                <NavItem to="/admin" icon={Settings} onClick={() => setIsMenuOpen(false)}>
                  <span className="inline">Configuration</span>
                </NavItem>
                <NavItem to="/planning" icon={CalendarClock} onClick={() => setIsMenuOpen(false)}>
                  <span className="inline">Planning</span>
                </NavItem>
                <NavItem to="/shift-exchange" icon={Repeat} onClick={() => setIsMenuOpen(false)}>
                  <span className="inline">BaG</span>
                </NavItem>
                <NavItem to="/direct-exchange" icon={Repeat} onClick={() => setIsMenuOpen(false)}>
                  <span className="inline">Échanges Directs</span>
                </NavItem>
              </>
            )}
            {user.roles.isAdmin && ( 
              <>
                <NavItem to="/admin" icon={Settings} onClick={() => setIsMenuOpen(false)}>
                  <span>Configuration</span>
                </NavItem>
                <NavItem to="/users" icon={Users} onClick={() => setIsMenuOpen(false)}>
                  <span>Utilisateurs</span>
                </NavItem>
                <NavItem to="/generated-planning" icon={CalendarClock} onClick={() => setIsMenuOpen(false)}>
                  <span>Gestion Planning</span>
                </NavItem>
                <NavItem to="/validated-plannings" icon={CheckSquare} onClick={() => setIsMenuOpen(false)}>
                  <span>Validés</span>
                </NavItem>
                <NavItem to="/admin-shift-exchange" icon={Repeat} onClick={() => setIsMenuOpen(false)}>
                  <span>Gestion BaG</span>
                </NavItem>
                <NavItem to="/remplacements" icon={Users} onClick={() => setIsMenuOpen(false)}>
                  <span>Remplacements</span>
                </NavItem>
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
