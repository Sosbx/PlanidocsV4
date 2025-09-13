import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, X, Info } from 'lucide-react';

interface ToastProps {
  message: string;
  isVisible: boolean;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number; // Durée en millisecondes avant fermeture automatique
}

const Toast: React.FC<ToastProps> = ({ message, isVisible, type = 'error', onClose, duration = 2000 }) => {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
    } else if (!isVisible && shouldRender) {
      // Attendre la fin de l'animation avant de retirer le composant du DOM
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 200); // Durée de l'animation de sortie
      return () => clearTimeout(timer);
    }
  }, [isVisible, shouldRender]);

  // Timer pour fermeture automatique
  useEffect(() => {
    if (isVisible && duration > 0) {
      const autoCloseTimer = setTimeout(() => {
        onClose();
      }, duration);
      
      return () => clearTimeout(autoCloseTimer);
    }
  }, [isVisible, duration, onClose]);

  if (!shouldRender) return null;

  const styles = {
    success: {
      bg: 'bg-green-50',
      text: 'text-green-800',
      icon: 'text-green-600',
      iconComponent: CheckCircle2
    },
    error: {
      bg: 'bg-red-50',
      text: 'text-red-800',
      icon: 'text-red-600',
      iconComponent: AlertCircle
    },
    info: {
      bg: 'bg-blue-50',
      text: 'text-blue-800',
      icon: 'text-blue-600',
      iconComponent: Info
    }
  };

  // Ensure the type exists in styles, default to error if not
  const safeType = type in styles ? type : 'error';
  const { bg, text, icon, iconComponent: Icon } = styles[safeType];

  const animationClass = isVisible ? 'animate-toast-fade-in' : 'animate-toast-fade-out';

  return (
    <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[10000] ${animationClass}`}>
      <div className={`${bg} ${text} px-4 py-3 pr-12 rounded-lg shadow-xl border border-opacity-20 flex items-center gap-2 min-w-[300px] max-w-[500px] relative backdrop-blur-sm`}>
        <Icon className={`h-5 w-5 ${icon} flex-shrink-0`} />
        <p className="text-sm font-medium flex-1">{message}</p>
        <button
          onClick={onClose}
          className={`absolute right-2 top-1/2 -translate-y-1/2 ${text} hover:opacity-70 transition-opacity p-1 rounded-full`}
          aria-label="Fermer la notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default Toast;
