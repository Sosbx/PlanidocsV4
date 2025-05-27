import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface ToastProps {
  message: string;
  isVisible: boolean;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, isVisible, type = 'error', onClose }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, 1500);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

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
      iconComponent: AlertCircle
    }
  };

  // Ensure the type exists in styles, default to error if not
  const safeType = type in styles ? type : 'error';
  const { bg, text, icon, iconComponent: Icon } = styles[safeType];

  return (
    <div className="fixed top-16 md:top-4 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
      <div className={`${bg} ${text} px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 min-w-[300px] justify-center`}>
        <Icon className={`h-5 w-5 ${icon}`} />
        <p className="text-sm font-medium">{message}</p>
      </div>
    </div>
  );
};

export default Toast;