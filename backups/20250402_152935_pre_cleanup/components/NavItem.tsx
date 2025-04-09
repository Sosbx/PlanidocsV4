import React from 'react';
import { NavLink } from 'react-router-dom';

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  children: React.ReactNode;
  onClick?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon: Icon, children, onClick }) => (
  <NavLink
    to={to}
    onClick={onClick}
    className={({ isActive }) =>
      `flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ease-in-out ${
        isActive
          ? 'bg-white text-blue-600 shadow-md transform scale-105'
          : 'text-blue-50 hover:bg-blue-500/50 hover:text-white'
      }`
    }
  >
    <Icon className="h-4 w-4 mr-2 transition-transform duration-200" />
    {children}
  </NavLink>
);

export default NavItem;