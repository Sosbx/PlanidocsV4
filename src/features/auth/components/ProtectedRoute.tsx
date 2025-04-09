import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../features/auth/hooks';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: ('isAdmin' | 'isUser' | 'isManager')[];
}

/**
 * Composant pour protéger les routes qui nécessitent une authentification
 * et/ou des rôles spécifiques
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Vérifier les rôles requis
  if (requiredRoles && !requiredRoles.some(role => user.roles[role])) {
    // Rediriger vers la page appropriée en fonction des rôles de l'utilisateur
    if (user.roles.isUser) {
      return <Navigate to="/user" replace />;
    } else if (user.roles.isAdmin) {
      return <Navigate to="/admin" replace />;
    } else if (user.roles.isManager) {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
