import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { generateCredentials } from '../../utils/userCredentials';
import { createUser } from '../../lib/firebase/auth/userCreation';
import { useAuth } from '../../hooks/useAuth';

interface BulkAddUserFormProps {
  onSuccess: () => void;
}

export const BulkAddUserForm: React.FC<BulkAddUserFormProps> = ({ onSuccess }) => {
  const [emails, setEmails] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user: currentUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.roles.isAdmin) return;
    
    setError('');
    setIsSubmitting(true);

    try {
      // Séparer les emails et supprimer les espaces
      const emailList = emails
        .split('\n')
        .map(email => email.trim())
        .filter(email => email !== '');

      if (emailList.length === 0) {
        throw new Error('Veuillez entrer au moins une adresse email');
      }

      // Créer les utilisateurs en séquence
      for (const email of emailList) {
        try {
          const credentials = generateCredentials(email);
          await createUser(credentials);
        } catch (err: any) {
          console.error(`Erreur lors de la création de l'utilisateur ${email}:`, err);
          throw new Error(`Erreur pour ${email}: ${err.message}`);
        }
      }

      setEmails('');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Emails des utilisateurs (un par ligne)
        </label>
        <div className="mt-1">
          <textarea
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="prenom1.nom1@h24scm.com&#10;prenom2.nom2@h24scm.com&#10;prenom3.nom3@h24scm.com"
            rows={8}
            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
            disabled={isSubmitting}
          />
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Format attendu : prenom.nom@h24scm.com
        </p>
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

      <button
        type="submit"
        disabled={isSubmitting || !currentUser?.roles.isAdmin}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        {isSubmitting ? "Création..." : "Créer les utilisateurs"}
      </button>
    </form>
  );
};