import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks';
import { LoginForm } from '../components';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithGoogle } = useAuth();
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Vérification en cours...');

  const handleLogin = async (email: string, password: string) => {
    setError('');
    setIsLoading(true);
    setLoadingMessage('Vérification en cours...');
    
    // Simuler un changement de message après un court délai
    const messageTimeout = setTimeout(() => {
      setLoadingMessage('Finalisation de la connexion...');
    }, 800);
    
    try {
      await login(email, password);
      clearTimeout(messageTimeout);
      setLoadingMessage('Connexion réussie !');
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (err) {
      clearTimeout(messageTimeout);
      const errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue lors de la connexion';
      setError(errorMessage);
      
      // Si le message indique d'utiliser Google, on peut optionnellement faire clignoter le bouton Google
      if (errorMessage.includes('connexion Google')) {
        // Petit délai pour que l'utilisateur lise le message
        setTimeout(() => {
          const googleButton = document.querySelector('[data-google-signin]');
          if (googleButton) {
            googleButton.classList.add('animate-pulse');
            // Retirer l'animation après quelques secondes
            setTimeout(() => {
              googleButton.classList.remove('animate-pulse');
            }, 3000);
          }
        }, 500);
      }
    } finally {
      setIsLoading(false);
      setLoadingMessage('Vérification en cours...');
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsLoading(true);
    
    try {
      await loginWithGoogle();
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de la connexion');
    } finally {
      setIsLoading(false);
    }
  };

  return <LoginForm 
    onSubmit={handleLogin} 
    onGoogleSignIn={handleGoogleSignIn} 
    error={error} 
    isLoading={isLoading}
    loadingMessage={loadingMessage}
  />;
};

export default LoginPage;
