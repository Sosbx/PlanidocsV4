import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Composant Error Boundary pour capturer les erreurs dans l'arbre de composants
 * Améliore l'expérience utilisateur en évitant les crashes complets
 */
export class ShiftExchangeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ShiftExchange Error:', error, errorInfo);
    
    this.setState({
      errorInfo
    });
    
    // Appeler le callback si fourni
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    // Logger l'erreur (peut être envoyé à un service de monitoring)
    if (typeof window !== 'undefined' && window.console) {
      console.group('🚨 Erreur dans la bourse aux gardes');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Component Stack:', errorInfo.componentStack);
      console.groupEnd();
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      // Si un fallback personnalisé est fourni
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      // Fallback par défaut
      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            
            <h2 className="mt-4 text-lg font-semibold text-center text-gray-900">
              Une erreur est survenue
            </h2>
            
            <p className="mt-2 text-sm text-center text-gray-600">
              Nous avons rencontré un problème lors du chargement de la bourse aux gardes.
            </p>
            
            {/* Détails de l'erreur en mode développement */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 p-3 bg-gray-50 rounded text-xs">
                <summary className="cursor-pointer font-medium text-gray-700">
                  Détails techniques
                </summary>
                <pre className="mt-2 overflow-auto text-gray-600">
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            
            <div className="mt-6 flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Réessayer
              </button>
              
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Retour au tableau de bord
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook pour utiliser l'Error Boundary de manière déclarative
 */
export const useErrorHandler = () => {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return {
    throwError: setError,
    clearError: () => setError(null)
  };
};

export default ShiftExchangeErrorBoundary;