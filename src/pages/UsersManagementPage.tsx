import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { AddUserModal } from '../components/users/AddUserModal';
import EditUserModal from '../components/users/EditUserModal';
import UsersList from '../components/users/UsersList';
import { useUsers } from '../context/UserContext';
import type { User } from '../types/users';

const UsersManagementPage: React.FC = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const { users, deleteUser, updateUser } = useUsers();

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      try {
        await deleteUser(userId);
      } catch (error) {
        console.error('Error deleting user:', error);
      }
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
  };

  const handleSaveUser = async (userId: string, roles: { isAdmin: boolean; isUser: boolean }) => {
    try {
      await updateUser(userId, { roles });
    } catch (error) {
      console.error('Error updating user roles:', error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Gestion des Utilisateurs</h1>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          <UserPlus className="h-5 w-5 mr-2" />
          Ajouter un utilisateur
        </button>
      </div>

      <div className="bg-white shadow-md rounded-lg">
        <UsersList 
          users={users} 
          onDelete={handleDeleteUser}
          onEdit={handleEditUser}
        />
      </div>

      <AddUserModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      <EditUserModal
        user={editingUser}
        isOpen={editingUser !== null}
        onClose={() => setEditingUser(null)}
        onSave={handleSaveUser}
      />
    </div>
  );
};

export default UsersManagementPage;