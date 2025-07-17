import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { useToast, ToastState, setGlobalToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info', persist?: boolean) => void;
  hideToast: () => void;
  toastState: ToastState;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { toastState, showToast, hideToast } = useToast();

  // Initialiser le toast global au montage
  useEffect(() => {
    setGlobalToast(showToast);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ToastContext.Provider value={{ showToast, hideToast, toastState }}>
      {children}
      <Toast
        message={toastState.message}
        isVisible={toastState.isVisible}
        type={toastState.type}
        onClose={hideToast}
      />
    </ToastContext.Provider>
  );
};

export const useToastContext = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext must be used within a ToastProvider');
  }
  return context;
};