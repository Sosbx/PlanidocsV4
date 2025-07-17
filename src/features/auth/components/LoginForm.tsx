import React, { useState, useEffect } from 'react';
import { User, Lock, X, Info, Eye, EyeOff, Shield, ChevronDown } from 'lucide-react';
import ForgotPasswordModal from './ForgotPasswordModal';
import HelpButton from './HelpButton';
import '../../../styles/LoginAnimations.css';

interface LoginFormProps {
  onSubmit: (login: string, password: string) => Promise<void>;
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
  const [showInfoBanner, setShowInfoBanner] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);

  useEffect(() => {
    setIsFormVisible(true);
    // Auto-transformer l'identifiant en majuscules
    const savedLogin = localStorage.getItem('rememberedLogin');
    if (savedLogin) {
      setLogin(savedLogin);
      setRememberMe(true);
    }
  }, []);

  // Réinitialiser le succès quand il y a une erreur
  useEffect(() => {
    if (error) {
      setLoginSuccess(false);
    }
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoading) {
      try {
        // Sauvegarder les préférences avant la tentative de connexion
        if (rememberMe) {
          localStorage.setItem('rememberedLogin', login.toUpperCase());
        } else {
          localStorage.removeItem('rememberedLogin');
        }
        
        // Attendre la réponse de la connexion
        await onSubmit(login.toUpperCase(), password);
        
        // Si on arrive ici, la connexion a réussi
        setLoginSuccess(true);
      } catch (err) {
        // L'erreur est gérée par le parent, on ne fait rien ici
        setLoginSuccess(false);
      }
    }
  };

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLogin(e.target.value.toUpperCase());
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex flex-col justify-center py-4 sm:py-6 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Éléments décoratifs d'arrière-plan */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-teal-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>
      {/* Footer avec liens de confidentialité */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200/50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Shield className="h-3.5 w-3.5 text-blue-500" />
              <span>© 2024 PlaniDocs - Tous droits réservés</span>
            </div>
            <div className="flex items-center gap-6">
              <a
                href="/terms"
                className="group flex items-center gap-1.5 text-xs text-gray-600 hover:text-blue-600 transition-all duration-200"
              >
                <svg className="h-3.5 w-3.5 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="font-medium">Règles d'utilisation</span>
              </a>
              <a
                href="/privacy"
                className="group flex items-center gap-1.5 text-xs text-gray-600 hover:text-blue-600 transition-all duration-200"
              >
                <svg className="h-3.5 w-3.5 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="font-medium">Politique de confidentialité</span>
              </a>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <svg className="h-3.5 w-3.5 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span>Site sécurisé</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bannière d'aide collapsible */}
      <div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${showInfoBanner ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="bg-blue-600 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center flex-1">
                <Info className="h-5 w-5 flex-shrink-0 mr-3 animate-pulse" />
                <p className="text-sm font-medium">
                  <span className="hidden sm:inline">Besoin d'aide pour vous connecter ? </span>
                  <span className="font-bold">ID: 4 lettres du NOM | MDP: 4 lettres du PRÉNOM + 33</span>
                </p>
              </div>
              <button
                onClick={() => setShowInfoBanner(false)}
                className="ml-4 text-white/80 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>


      <div className={`sm:mx-auto sm:w-full sm:max-w-md relative z-10 transition-all duration-1000 ${isFormVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="flex flex-col items-center">
          {/* Logo avec animation */}
          <div className="w-32 h-32 sm:w-40 sm:h-40 relative mb-2">
            <div className="absolute inset-0 bg-blue-400 rounded-full opacity-20 blur-2xl animate-pulse"></div>
            <img 
              src="/Logo.png" 
              alt="PlaniDoc Logo" 
              className="relative w-full h-full object-contain drop-shadow-xl animate-logo-float"
            />
          </div>
          
          {/* Titre avec animation */}
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-black flex items-start justify-center tracking-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-500">PlaniDoc</span>
              <span className="text-lg sm:text-xl font-bold text-blue-600 ml-1">s</span>
            </h2>
          </div>
        </div>
      </div>

      <div className={`mt-4 sm:mt-6 sm:mx-auto sm:w-full sm:max-w-md relative z-10 transition-all duration-1000 delay-300 ${isFormVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="bg-white/95 backdrop-blur-sm py-6 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-gray-100 relative overflow-hidden">
          {/* Effet de brillance */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 translate-x-[-200%] animate-shimmer"></div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg relative animate-shake" role="alert">
                <span className="block sm:inline">{error}</span>
              </div>
            )}

            {loginSuccess && !error && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg relative animate-fade-in-up flex items-center gap-2" role="alert">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" className="checkmark-animation" />
                </svg>
                <span>Connexion réussie, redirection...</span>
              </div>
            )}

            {onGoogleSignIn && (
              <>
                <div>
                  <button
                    type="button"
                    onClick={onGoogleSignIn}
                    disabled={isLoading || loginSuccess}
                    className={`w-full flex items-center justify-center gap-3 py-3.5 px-4 border-2 border-blue-400 rounded-lg shadow-lg text-base font-medium text-gray-700 bg-white
                      ${isLoading || loginSuccess
                        ? 'opacity-75 cursor-not-allowed' 
                        : 'hover:bg-gray-50 hover:border-blue-500 hover:shadow-xl hover-lift transform hover:scale-[1.02]'} 
                      focus:outline-none focus:ring-4 focus:ring-blue-300 focus:ring-opacity-50 transition-all duration-300`}
                  >
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    {isLoading ? 'Connexion...' : 'Se connecter avec son compte Google/H24'}
                  </button>
                </div>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-3 bg-white text-gray-400 uppercase tracking-wider">ou connexion classique</span>
                  </div>
                </div>
              </>
            )}

            <div className="opacity-75">
              <label htmlFor="login" className="block text-sm font-medium text-gray-600">
                Identifiant
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="login"
                  type="text"
                  required
                  value={login}
                  onChange={handleLoginChange}
                  disabled={isLoading}
                  placeholder="DUPO"
                  className="block w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed transition-all duration-300 bg-gray-50"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="opacity-75">
              <label htmlFor="password" className="block text-sm font-medium text-gray-600">
                Mot de passe
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400 hover:text-gray-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400 hover:text-gray-500" />
                  )}
                </button>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  placeholder="MARC33"
                  className="block w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed transition-all duration-300 bg-gray-50"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <div className="flex items-center justify-between opacity-75">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-3.5 w-3.5 text-blue-500 focus:ring-blue-400 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-xs text-gray-600">
                  Se souvenir de moi
                </label>
              </div>
              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(true)}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                Mot de passe oublié ?
              </button>
            </div>

            <div className="opacity-75">
              <button
                type="submit"
                disabled={isLoading || loginSuccess}
                className={`w-full flex justify-center items-center py-2 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 
                  ${isLoading || loginSuccess
                    ? 'bg-gray-100 cursor-not-allowed' 
                    : 'bg-gray-50 hover:bg-gray-100'} 
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 transition-all duration-300`}
              >
                {isLoading ? (
                  <div className="loading-spinner"></div>
                ) : loginSuccess ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  'Se connecter'
                )}
              </button>
            </div>
          </form>

          {/* Badge de sécurité */}
          <div className="mt-4 flex items-center justify-center text-xs text-gray-500">
            <Shield className="h-4 w-4 mr-1 text-green-500" />
            Connexion sécurisée et chiffrée
          </div>
        </div>
      </div>

      <ForgotPasswordModal 
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
      />

      {/* Bouton d'aide flottant */}
      <HelpButton />

      {/* Styles additionnels */}
      <style>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        @keyframes shimmer {
          100% {
            transform: translateX(200%) skewX(-12deg);
          }
        }
        .animate-shimmer {
          animation: shimmer 8s infinite;
        }
        @keyframes shake {
          0%, 100% {
            transform: translateX(0);
          }
          10%, 30%, 50%, 70%, 90% {
            transform: translateX(-2px);
          }
          20%, 40%, 60%, 80% {
            transform: translateX(2px);
          }
        }
        .animate-shake {
          animation: shake 0.5s;
        }
      `}</style>
    </div>
  );
};

export default LoginForm;
