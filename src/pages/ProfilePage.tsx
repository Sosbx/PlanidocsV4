import React, { useState, useEffect } from 'react';
import { User, Mail, AlertCircle, Key } from 'lucide-react';
import { useAuth } from '../features/auth/hooks';
import { resetPassword } from '../lib/firebase/auth/session';
import LoadingSpinner from '../components/common/LoadingSpinner';

const ProfilePage: React.FC = () => {
  const { user, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  if (loading || !user) {
    return <LoadingSpinner />;
  }

  const handleResetPassword = async () => {
    if (!user) return;
    setIsResettingPassword(true);
    setError(null);
    setSuccess(null);

    try {
      await resetPassword(user.login);
      setSuccess('Un email de réinitialisation a été envoyé à votre adresse email');
    } catch (err) {
      setError('Erreur lors de l\'envoi de l\'email de réinitialisation');
      console.error('Error resetting password:', err);
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Mon Profil</h1>

      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Prénom
              </label>
              <div className="mt-1 relative">
                <input
                  type="text"
                  readOnly
                  value={user.firstName}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700 cursor-not-allowed select-none"
                  required
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Nom
              </label>
              <div className="mt-1 relative">
                <input
                  type="text"
                  readOnly
                  value={user.lastName}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700 cursor-not-allowed select-none"
                  required
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <div className="mt-1 relative">
                <input
                  readOnly
                  type="email"
                  value={user.email}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700 cursor-not-allowed select-none"
                  required
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Identifiant
              </label>
              <div className="mt-1 relative">
                <input
                  type="text"
                  readOnly
                  value={user.login}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700 cursor-not-allowed select-none"
                  required
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>

            <div>
              <div className="mt-1">
                <button
                  onClick={handleResetPassword}
                  disabled={isResettingPassword}
                  className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 flex items-center gap-2"
                >
                  <Key className="h-4 w-4" />
                  {isResettingPassword ? 'Envoi...' : 'Réinitialiser mot de passe'}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="rounded-md bg-green-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">{success}</p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ProfilePage;