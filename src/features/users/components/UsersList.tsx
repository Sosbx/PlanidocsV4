import React from 'react';
import { Mail, Trash2, Settings } from 'lucide-react';
import type { User } from '../types';
import { SYSTEM_ADMIN_EMAIL } from '../../../lib/firebase/config';

interface UsersListProps {
  users: User[];
  onDelete: (userId: string) => void;
  onEdit: (user: User) => void;
}

export const UsersList: React.FC<UsersListProps> = ({ users, onDelete, onEdit }) => {
  // Séparer l'admin système des autres utilisateurs et trier les autres par nom
  const adminUser = users.find(user => user.email === SYSTEM_ADMIN_EMAIL);
  const otherUsers = users
    .filter(user => user.email !== SYSTEM_ADMIN_EMAIL)
    .sort((a, b) => {
      const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
      const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });

  const getRoleBadges = (user: User) => {
    const badges = [];
    
    if (user.roles.isAdmin) {
      badges.push(
        <span key="admin" className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 mr-1">
          Administrateur
        </span>
      );
    }
    
    if (user.roles.isUser) {
      badges.push(
        <span key="user" className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          Associé
        </span>
      );
    }
    
    if (user.roles.isManager) {
      badges.push(
        <span key="manager" className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 ml-1">
          Gérant
        </span>
      );
    }
    
    if (user.roles.isPartTime) {
      badges.push(
        <span key="part-time" className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 ml-1">
          Mi-temps
        </span>
      );
    }
    
    if (user.roles.isCAT) {
      badges.push(
        <span key="cat" className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 ml-1">
          CAT
        </span>
      );
    }
    
    return badges;
  };

  const renderUserRow = (user: User, index?: number) => (
    <tr key={user.id} className="hover:bg-gray-50">
      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
        {user.email === SYSTEM_ADMIN_EMAIL ? '' : index}
      </td>
      <td className="px-3 py-4">
        <div className="text-sm font-medium text-gray-900">
          {user.lastName} {user.firstName}
        </div>
        <div className="flex items-center text-sm text-gray-500 mt-1">
          <Mail className="h-4 w-4 mr-1 flex-shrink-0" />
          <span className="truncate">{user.email}</span>
        </div>
      </td>
      <td className="px-3 py-4">
        <div className="text-sm font-medium text-gray-900">
          Login: <span className="font-mono">{user.login}</span>
        </div>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="flex flex-wrap gap-1">
          {getRoleBadges(user)}
        </div>
      </td>
      <td className="px-3 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex justify-end space-x-2">
          <button
            onClick={() => onEdit(user)}
            className="text-indigo-600 hover:text-indigo-900 p-1 rounded-full hover:bg-indigo-50"
            title="Modifier les rôles"
            disabled={user.email === SYSTEM_ADMIN_EMAIL}
          >
            <Settings className={`h-4 w-4 ${user.email === SYSTEM_ADMIN_EMAIL ? 'opacity-50 cursor-not-allowed' : ''}`} />
          </button>
          <button
            onClick={() => onDelete(user.id)}
            className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50"
            title="Supprimer"
            disabled={user.email === SYSTEM_ADMIN_EMAIL}
          >
            <Trash2 className={`h-4 w-4 ${user.email === SYSTEM_ADMIN_EMAIL ? 'opacity-50 cursor-not-allowed' : ''}`} />
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              #
            </th>
            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Utilisateur
            </th>
            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Identifiant
            </th>
            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Rôles
            </th>
            <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {adminUser && renderUserRow(adminUser)}
          {otherUsers.map((user, index) => renderUserRow(user, index + 1))}
        </tbody>
      </table>
    </div>
  );
};
