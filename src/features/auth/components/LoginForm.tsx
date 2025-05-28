import React, { useState } from 'react';
import { User, Lock, X, Info, Eye, EyeOff } from 'lucide-react';
import ForgotPasswordModal from './ForgotPasswordModal';

interface LoginFormProps {
  onSubmit: (login: string, password: string) => void;
  onGoogleSignIn?: () => void;
  error?: string;
  isLoading?: boolean;
}

/**
 * Formulaire de connexion
 */
const LoginForm: React.FC<LoginFormProps> = ({ onSubmit, onGoogleSignIn, error, isLoading = false }) => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showInfoBanner, setShowInfoBanner] = useState(true);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoading) {
      onSubmit(login, password);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Footer avec liens de confidentialité */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t border-gray-200 p-4">
        <div className="max-w-7xl mx-auto flex justify-center gap-8 text-sm">
          <a
            href="/terms"
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            Règles d'utilisation
          </a>
          <a
            href="/privacy"
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            Politique de confidentialité
          </a>
        </div>
      </div>

      {showInfoBanner && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-50 border-b border-yellow-200 p-4 z-[9999] shadow-md">
          <div className="max-w-7xl mx-auto relative px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => setShowInfoBanner(false)}
              className="absolute top-1/2 right-4 -translate-y-1/2 text-yellow-600 hover:text-yellow-800 transition-colors z-[9999]"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center pr-8">
              <Info className="h-6 w-6 text-yellow-600 flex-shrink-0 mr-3" />
              <div className="text-sm text-red-600 font-medium">
                <span className="font-bold"> Pour vous connecter : EN MAJUSCULES</span>
                <ul className="list-disc list-inside mt-1">
                  <li><span className="font-medium">Id :</span> 4 1ères lettres du NOM <span className="font-bold">(ex: Dupont → DUPO)</span></li>
                  <li><span className="font-medium">Mdp :</span> 4 1ères lettres du PRÉNOM + "33" <span className="font-bold">(ex: Marcel → MARC33)</span></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex flex-col items-center">
          <div className="w-56 h-56 relative mb-2">
            <img 
              src="/Logo.png" 
              alt="PlaniDoc Logo" 
              className="w-full h-full object-contain drop-shadow-xl"
            />
          </div>
          <h2 className="text-5xl font-black flex items-start tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 drop-shadow-[0_2px_2px_rgba(0,0,0,0.2)]">PlaniDoc</span>
            <span className="text-2xl font-bold text-blue-600 drop-shadow-sm">s</span>
          </h2>
          <p className="mt-2 text-xl text-gray-600 font-light">
            Planification des desiderata
          </p>
        </div>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-2xl sm:rounded-xl sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg relative" role="alert">
                <span className="block sm:inline">{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="login" className="block text-sm font-medium text-gray-700">
                Identifiant
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="login"
                  type="text"
                  required
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  disabled={isLoading}
                  className="block w-full pl-10 pr-3 py-2 sm:text-sm border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Mot de passe
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="block w-full pl-10 pr-10 py-2 sm:text-sm border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(true)}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
              >
                Mot de passe oublié ?
              </button>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white 
                  ${isLoading 
                    ? 'bg-indigo-400 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-700'} 
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors`}
              >
                {isLoading ? 'Connexion...' : 'Se connecter'}
              </button>
            </div>

            {onGoogleSignIn && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">ou</span>
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={onGoogleSignIn}
                    disabled={isLoading}
                    className={`w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white
                      ${isLoading 
                        ? 'cursor-not-allowed opacity-50' 
                        : 'hover:bg-gray-50'} 
                      focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors`}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    {isLoading ? 'Connexion...' : 'Se connecter avec Google'}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </div>

      <ForgotPasswordModal 
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
      />
    </div>
  );
};

export default LoginForm;
