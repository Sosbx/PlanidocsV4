import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import LoadingSpinner from '../common/LoadingSpinner';
import Toast from '../Toast';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ 
  message = 'Chargement des échanges de gardes...' 
}) => {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <LoadingSpinner />
      <p className="mt-4 text-gray-600 text-center max-w-md">
        {message}
      </p>
      <p className="mt-2 text-gray-500 text-xs text-center max-w-md">
        Si le chargement persiste, un index Firebase pourrait être nécessaire.
      </p>
    </div>
  );
};

interface EmptyStateProps {
  message?: string;
  subMessage?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  message = 'Aucune garde disponible',
  subMessage = 'Modifiez vos filtres ou revenez plus tard'
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-8 text-center">
      <div className="flex flex-col items-center gap-2">
        <Info className="h-6 w-6 text-indigo-300" />
        <p className="text-gray-600 font-medium text-sm">
          {message}
        </p>
        <p className="text-gray-500 text-xs">
          {subMessage}
        </p>
      </div>
    </div>
  );
};

interface ErrorStateProps {
  message: string;
  toastMessage: string;
  toastVisible: boolean;
  toastType: 'success' | 'error' | 'info';
  onCloseToast: () => void;
  onRetry: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message,
  toastMessage,
  toastVisible,
  toastType,
  onCloseToast,
  onRetry
}) => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Toast 
        message={toastMessage}
        isVisible={toastVisible}
        type={toastType}
        onClose={onCloseToast}
      />
      
      <div className="bg-white rounded-lg shadow-md p-8 mt-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <AlertTriangle className="h-10 w-10 text-amber-400" />
          <h2 className="text-xl font-semibold text-gray-800">Impossible de charger les échanges</h2>
          <p className="text-gray-600 max-w-md">
            {message}
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={onRetry}
              className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              Réessayer
            </button>
            <p className="text-xs text-gray-500 max-w-[300px] mx-auto">
              Problème d'index Firebase détecté. Vérifiez la console pour le lien de création d'index.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};