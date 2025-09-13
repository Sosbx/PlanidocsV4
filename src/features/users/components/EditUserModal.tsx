import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { User, UserRoleFlags } from '../types';

interface EditUserModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (userId: string, data: { 
    roles: { isAdmin: boolean; isUser: boolean; isManager: boolean; isPartTime: boolean; isCAT: boolean; isReplacement: boolean },
    firstName?: string,
    lastName?: string
  }) => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({ user, isOpen, onClose, onSave }) => {
  const [roles, setRoles] = useState<UserRoleFlags | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setRoles({
        isAdmin: user.roles.isAdmin || false,
        isUser: user.roles.isUser || false,
        isManager: user.roles.isManager || false,
        isPartTime: user.roles.isPartTime || false,
        isCAT: user.roles.isCAT || false,
        isReplacement: user.roles.isReplacement || false
      });
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
    } else {
      setRoles(null);
      setFirstName('');
      setLastName('');
    }
  }, [user]);

  if (!isOpen || !user || !roles) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(user.id, {
        roles,
        firstName: firstName.trim(),
        lastName: lastName.trim()
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Modifier l'utilisateur</h2>
          <button 
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Informations personnelles</h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                  Nom
                </label>
                <input
                  type="text"
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  Prénom
                </label>
                <input
                  type="text"
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div>
                <p className="text-sm text-gray-500">Email: {user.email}</p>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rôles
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={roles.isAdmin}
                  onChange={(e) => setRoles(prev => ({ ...prev!, isAdmin: e.target.checked }) as UserRoleFlags)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  disabled={isSubmitting}
                />
                <span className="ml-2 text-sm text-gray-700">Administrateur</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={roles.isUser}
                  onChange={(e) => setRoles(prev => ({ ...prev!, isUser: e.target.checked }) as UserRoleFlags)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  disabled={isSubmitting}
                />
                <span className="ml-2 text-sm text-gray-700">Associé</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={roles.isManager}
                  onChange={(e) => setRoles(prev => ({ ...prev!, isManager: e.target.checked }) as UserRoleFlags)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  disabled={isSubmitting}
                />
                <span className="ml-2 text-sm text-gray-700">Gérant</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={roles.isPartTime}
                  onChange={(e) => setRoles(prev => ({ ...prev!, isPartTime: e.target.checked }) as UserRoleFlags)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  disabled={isSubmitting}
                />
                <span className="ml-2 text-sm text-gray-700">Mi-temps</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={roles.isCAT}
                  onChange={(e) => setRoles(prev => ({ ...prev!, isCAT: e.target.checked }) as UserRoleFlags)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  disabled={isSubmitting}
                />
                <span className="ml-2 text-sm text-gray-700">CAT</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={roles.isReplacement}
                  onChange={(e) => setRoles(prev => ({ ...prev!, isReplacement: e.target.checked }) as UserRoleFlags)}
                  className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 h-4 w-4"
                  disabled={isSubmitting}
                />
                <span className="ml-2 text-sm text-gray-700">Remplaçant</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (!roles.isAdmin && !roles.isUser)}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
