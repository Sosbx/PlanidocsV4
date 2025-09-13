import React, { useState } from 'react';
import { useAuth } from '../../../features/auth/hooks';
import { Clock, RefreshCw, FileText, Users } from 'lucide-react';
import { HistoryTab } from '../types';
import ExchangeHistoryTable from '../components/ExchangeHistoryTable';
import BagHistoryTable from '../components/BagHistoryTable';
import ReplacementHistoryTable from '../components/ReplacementHistoryTable';
import HistoryFilters from '../components/HistoryFilters';
import { HistoryFilters as HistoryFiltersType } from '../types';

const HistoryPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<HistoryTab>('exchanges');
  const [filters, setFilters] = useState<HistoryFiltersType>({
    startDate: null,
    endDate: null,
    searchTerm: '',
  });
  const [showAllUsers, setShowAllUsers] = useState(false);

  const tabs = [
    {
      id: 'exchanges' as HistoryTab,
      label: 'Cession/Échange',
      icon: RefreshCw,
      description: 'Historique des échanges directs et cessions',
    },
    {
      id: 'bag' as HistoryTab,
      label: 'Bourse aux Gardes',
      icon: FileText,
      description: 'Historique des échanges via la BaG',
    },
    {
      id: 'replacements' as HistoryTab,
      label: 'Remplacements',
      icon: Users,
      description: 'Historique des remplacements',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-primary-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Historique</h1>
                <p className="text-gray-600">
                  Consultez l'historique de vos échanges et modifications de planning
                </p>
              </div>
            </div>
            {user?.isAdmin && (
              <div className="flex items-center space-x-2">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showAllUsers}
                    onChange={(e) => setShowAllUsers(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">
                    Voir tous les utilisateurs
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                      ${
                        activeTab === tab.id
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    <Icon
                      className={`
                        -ml-0.5 mr-2 h-5 w-5
                        ${
                          activeTab === tab.id
                            ? 'text-primary-500'
                            : 'text-gray-400 group-hover:text-gray-500'
                        }
                      `}
                    />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Filters */}
        <HistoryFilters
          filters={filters}
          onFiltersChange={setFilters}
          activeTab={activeTab}
        />

        {/* Content */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          {activeTab === 'exchanges' && (
            <ExchangeHistoryTable
              filters={filters}
              showAllUsers={showAllUsers}
              userId={user?.id}
            />
          )}
          {activeTab === 'bag' && (
            <BagHistoryTable
              filters={filters}
              showAllUsers={showAllUsers}
              userId={user?.id}
            />
          )}
          {activeTab === 'replacements' && (
            <ReplacementHistoryTable
              filters={filters}
              showAllUsers={showAllUsers}
              userId={user?.id}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;