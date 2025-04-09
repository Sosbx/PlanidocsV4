import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { generateCredentials } from '../utils';
import { createUser } from '../../../lib/firebase/auth/userCreation';
import { useAuth } from '../../../features/auth/hooks';

interface AddUserFormProps {
  type: 'h24' | 'external';
  onSuccess: () => void;
}

export const AddUserForm: React.FC<AddUserFormProps> = ({ type, onSuccess }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user: currentUser } = useAuth();

  const getEmailPlaceholder = () => {
    if (type === 'h24') {
      return 'prenom.nom@h24scm.com';
    }
    return 'prenom.nom@example.com';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.roles.isAdmin) return;
    
    setError('');
    setIsSubmitting(true);

    try {
      const credentials = generateCredentials(
        type === 'external' 
          ? { firstName, lastName, email }
          : { email }
      );

      await createUser(credentials);
      setEmail('');
      setFirstName('');
      setLastName('');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {type === 'external' ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Nom
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Nom"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                disabled={isSubmitting}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Prénom
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Prénom"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                disabled={isSubmitting}
                required
              />
            </div>
          </div>
        </>
      ) : null}
      <label className="block text-sm font-medium text-gray-700">
        {type === 'external' ? 'Domaine email' : 'Email de l\'utilisateur'}
      </label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={getEmailPlaceholder()}
        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        disabled={isSubmitting}
        required
      />

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

      <button
        type="submit"
        disabled={isSubmitting || !currentUser?.roles.isAdmin}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        {isSubmitting ? "Création..." : "Créer l'utilisateur"}
      </button>
    </form>
  );
};
