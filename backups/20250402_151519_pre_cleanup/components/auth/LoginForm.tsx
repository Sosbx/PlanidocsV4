import React, { useState } from 'react';
import { User, Lock, X, Info, Eye, EyeOff } from 'lucide-react';
import ForgotPasswordModal from './ForgotPasswordModal';

interface LoginFormProps {
  onSubmit: (login: string, password: string) => void;
  error?: string;
  isLoading?: boolean;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSubmit, error, isLoading = false }) => {
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