import React, { useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';

interface ToastProps {
  message: string;
  isVisible: boolean;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({
  message,
  isVisible,
  type = 'success',
  onClose,
  duration = 5000
}) => {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const bgColor = type === 'success' 
    ? 'bg-green-50 border-green-500' 
    : type === 'error' 
      ? 'bg-red-50 border-red-500' 
      : 'bg-blue-50 border-blue-500';
  
  const textColor = type === 'success' 
    ? 'text-green-800' 
    : type === 'error' 
      ? 'text-red-800' 
      : 'text-blue-800';
  
  const iconColor = type === 'success' 
    ? 'text-green-500' 
    : type === 'error' 
      ? 'text-red-500' 
      : 'text-blue-500';
  
  const Icon = type === 'success' 
    ? CheckCircle 
    : type === 'error' 
      ? AlertCircle 
      : Info;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <div className={`flex items-start p-4 rounded-lg shadow-md border ${bgColor}`}>
        <div className="flex-shrink-0">
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div className="ml-3 flex-1">
          <p className={`text-sm font-medium ${textColor}`}>{message}</p>
        </div>
        <div className="ml-4 flex-shrink-0 flex">
          <button
            type="button"
            className={`inline-flex rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${type === 'success' ? 'green' : type === 'error' ? 'red' : 'blue'}-500`}
            onClick={onClose}
          >
            <span className="sr-only">Fermer</span>
            <X className={`h-5 w-5 ${textColor}`} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toast;
