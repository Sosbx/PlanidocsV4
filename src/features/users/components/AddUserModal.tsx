import React, { useState } from 'react';
import { X, AlertCircle, UserPlus, Users, Building2 } from 'lucide-react';
import { AddUserForm } from './AddUserForm.tsx';
import { BulkAddUserForm } from './BulkAddUserForm.tsx';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'h24-single' | 'h24-bulk' | 'external';

export const AddUserModal: React.FC<AddUserModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('h24-single');

  if (!isOpen) return null;

  const tabs = [
    {
      id: 'h24-single',
      label: 'H24 Individuel',
      icon: UserPlus
    },
    {
      id: 'h24-bulk',
      label: 'H24 Multiple',
      icon: Users
    },
    {
      id: 'external',
      label: 'Hors H24',
      icon: Building2
    }
  ] as const;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Ajouter des utilisateurs</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-4" aria-label="Tabs">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`${
                    activeTab === id
                      ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  } flex items-center gap-2 whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm rounded-t-lg transition-colors`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {activeTab === 'h24-single' && <AddUserForm type="h24" onSuccess={onClose} />}
        {activeTab === 'external' && <AddUserForm type="external" onSuccess={onClose} />}
        {activeTab === 'h24-bulk' && (
          <BulkAddUserForm onSuccess={onClose} />
        )}
      </div>
    </div>
  );
};
