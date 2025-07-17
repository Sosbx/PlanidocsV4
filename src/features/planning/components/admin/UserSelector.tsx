import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Search, ChevronDown } from 'lucide-react';
import type { User } from '../../../../types/users';

interface UserSelectorProps {
  users: User[] | string[];
  selectedUserId: string;
  onUserChange: (userId: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  showSearch?: boolean;
}

/**
 * Composant pour sélectionner un utilisateur
 */
const UserSelector: React.FC<UserSelectorProps> = ({
  users,
  selectedUserId,
  onUserChange,
  onPrevious,
  onNext,
  showSearch = false
}) => {
  // États locaux
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Trier les utilisateurs par ordre alphabétique
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const nameA = typeof a !== 'string' ? `${a.lastName} ${a.firstName}` : a;
      const nameB = typeof b !== 'string' ? `${b.lastName} ${b.firstName}` : b;
      return nameA.localeCompare(nameB);
    });
  }, [users]);

  // Filtrer les utilisateurs en fonction du terme de recherche
  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return sortedUsers;
    
    return sortedUsers.filter(user => {
      // Si user est un objet User
      if (typeof user !== 'string') {
        const fullName = `${user.lastName} ${user.firstName}`.toLowerCase();
        return fullName.includes(searchTerm.toLowerCase());
      }
      // Si user est une chaîne de caractères (ID)
      return user.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [sortedUsers, searchTerm]);

  // Formater le nom de l'utilisateur pour l'affichage
  const formatUserName = (user: User | string): string => {
    if (typeof user === 'string') {
      return user; // Retourner l'ID si c'est une chaîne
    }
    return `${user.lastName} ${user.firstName}`;
  };

  // Trouver l'utilisateur sélectionné
  const selectedUser = useMemo(() => {
    return users.find(user => {
      if (typeof user === 'string') {
        return user === selectedUserId;
      }
      return user.id === selectedUserId;
    });
  }, [users, selectedUserId]);

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="flex items-center gap-2 mb-4">
      <button
        onClick={onPrevious}
        className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
        title="Utilisateur précédent"
      >
        <ChevronLeft className="h-5 w-5 text-gray-600" />
      </button>
      
      <div className="relative flex-1 max-w-xs" ref={dropdownRef}>
        {/* Sélecteur stylisé */}
        <div 
          className="flex items-center justify-between w-full px-4 py-2 text-sm border border-gray-300 rounded-md bg-white cursor-pointer"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>{selectedUser ? formatUserName(selectedUser) : 'Sélectionner un utilisateur'}</span>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </div>
        
        {/* Dropdown personnalisé */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
            {/* Champ de recherche en haut de la liste */}
            {showSearch && (
              <div className="sticky top-0 p-2 bg-white border-b border-gray-200">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Rechercher..."
                    className="block w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            )}
            
            {/* Liste des utilisateurs */}
            <div className="py-1">
              {filteredUsers.length === 0 ? (
                <div className="px-4 py-2 text-sm text-gray-500">
                  Aucun utilisateur trouvé
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const userId = typeof user === 'string' ? user : user.id;
                  const isSelected = userId === selectedUserId;
                  
                  return (
                    <div
                      key={userId}
                      className={`px-4 py-2 text-sm cursor-pointer ${
                        isSelected 
                          ? 'bg-indigo-100 text-indigo-900' 
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => {
                        onUserChange(userId);
                        setIsOpen(false);
                      }}
                    >
                      {formatUserName(user)}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
      
      <button
        onClick={onNext}
        className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
        title="Utilisateur suivant"
      >
        <ChevronRight className="h-5 w-5 text-gray-600" />
      </button>
    </div>
  );
};

export default UserSelector;
