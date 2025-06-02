import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, X, Users, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { ShiftExchange as PlanningShiftExchange } from '../../../../types/planning';
import type { ShiftExchange as FeatureShiftExchange } from '../../types';
import type { User } from '../../../../types/users';

// Type union pour accepter les deux types de ShiftExchange
type ShiftExchange = PlanningShiftExchange | FeatureShiftExchange;

interface ParticipationPanelProps {
  exchanges: ShiftExchange[];
  users: User[];
  history: any[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

interface UserStats {
  userId: string;
  userName: string;
  interestCount: number; // Nombre de positions demandées
  interestRate: number; // Taux d'intérêt (demandes/total postes)
  receivedCount: number; // Nombre de postes reçus
  attributionRate: number; // Taux d'attribution (reçus/demandes)
}

type SortField = 'userName' | 'interestRate' | 'attributionRate';
type SortDirection = 'asc' | 'desc';

const ParticipationPanel: React.FC<ParticipationPanelProps> = ({
  exchanges,
  users,
  history,
  isOpen,
  onToggle,
  onClose
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [sortField, setSortField] = useState<SortField>('interestRate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc'); // 'asc' pour privilégier ceux qui demandent moins

  // Calculer les statistiques pour chaque utilisateur
  const userStats = useMemo(() => {
    const stats: Record<string, UserStats> = {};
    const totalPositions = exchanges.length;

    // Initialiser les stats pour tous les utilisateurs
    users.forEach(user => {
      stats[user.id] = {
        userId: user.id,
        userName: user.lastName?.toUpperCase() || 'INCONNU',
        interestCount: 0,
        interestRate: 0,
        receivedCount: 0,
        successRate: 0
      };
    });

    // Compter les intérêts
    exchanges.forEach(exchange => {
      if (exchange.interestedUsers) {
        exchange.interestedUsers.forEach(userId => {
          if (stats[userId]) {
            stats[userId].interestCount++;
          }
        });
      }
    });

    // Compter les postes reçus
    history.forEach(h => {
      if (h.newUserId && stats[h.newUserId]) {
        stats[h.newUserId].receivedCount++;
      }
    });

    // Calculer les taux
    Object.values(stats).forEach(stat => {
      stat.interestRate = totalPositions > 0 
        ? Math.round((stat.interestCount / totalPositions) * 100) 
        : 0;
      
      stat.attributionRate = stat.interestCount > 0 
        ? Math.round((stat.receivedCount / stat.interestCount) * 100)
        : 0;
    });

    // Filtrer uniquement les utilisateurs qui ont au moins manifesté un intérêt
    return Object.values(stats).filter(stat => stat.interestCount > 0);
  }, [exchanges, users, history]);

  // Fonction de tri
  const sortedStats = useMemo(() => {
    const sorted = [...userStats];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'userName':
          comparison = a.userName.localeCompare(b.userName);
          break;
        case 'interestRate':
          comparison = a.interestRate - b.interestRate;
          break;
        case 'attributionRate':
          comparison = a.attributionRate - b.attributionRate;
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [userStats, sortField, sortDirection]);

  // Gérer le clic sur les en-têtes
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'interestRate' ? 'asc' : 'desc');
    }
  };

  if (!isOpen) return null;

  const getColorForInterestRate = (rate: number) => {
    // Inversé : moins de demandes = mieux
    if (rate <= 25) return 'text-green-600';
    if (rate <= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getBackgroundForInterestRate = (rate: number) => {
    // Inversé : moins de demandes = mieux
    if (rate <= 25) return 'bg-green-50';
    if (rate <= 50) return 'bg-orange-50';
    return 'bg-red-50';
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 text-indigo-600" />
      : <ArrowDown className="h-3 w-3 text-indigo-600" />;
  };

  return (
    <div className={`fixed right-4 top-20 z-50 transition-all duration-300 ${
      isMinimized ? 'w-64' : 'w-96'
    }`}>
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
        {/* En-tête */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <h3 className="font-semibold text-sm">
              Taux de Participation BAG
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              title={isMinimized ? "Agrandir" : "Réduire"}
            >
              {isMinimized ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              title="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Contenu */}
        {!isMinimized && (
          <div className="max-h-[600px] overflow-y-auto">
            {/* Résumé */}
            <div className="p-3 bg-gray-50 border-b border-gray-200">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-600">Total postes BAG:</span>
                  <span className="font-semibold ml-1">{exchanges.length}</span>
                </div>
                <div>
                  <span className="text-gray-600">Médecins actifs:</span>
                  <span className="font-semibold ml-1">{userStats.length}</span>
                </div>
              </div>
            </div>

            {/* Tableau des statistiques */}
            <div className="p-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th 
                      className="text-left py-2 px-1 text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('userName')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Médecin</span>
                        {getSortIcon('userName')}
                      </div>
                    </th>
                    <th 
                      className="text-center py-2 px-1 text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-50" 
                      title="Demandes / Total BAG"
                      onClick={() => handleSort('interestRate')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Taux Intérêt</span>
                        {getSortIcon('interestRate')}
                      </div>
                    </th>
                    <th 
                      className="text-center py-2 px-1 text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-50" 
                      title="Postes reçus / Demandes"
                      onClick={() => handleSort('attributionRate')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Taux Attribution</span>
                        {getSortIcon('attributionRate')}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStats.map((stat) => (
                      <tr 
                        key={stat.userId} 
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-2 px-1">
                          <span className="font-medium truncate block max-w-[140px]" title={stat.userName}>
                            {stat.userName}
                          </span>
                        </td>
                        <td className="text-center py-2 px-1">
                          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${getBackgroundForInterestRate(stat.interestRate)}`}>
                            <span className={`font-semibold ${getColorForInterestRate(stat.interestRate)}`}>
                              {stat.interestRate}%
                            </span>
                            <span className="text-xs text-gray-600">
                              ({stat.interestCount}/{exchanges.length})
                            </span>
                          </div>
                        </td>
                        <td className="text-center py-2 px-1">
                          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${
                            stat.attributionRate >= 50 ? 'bg-blue-50' :
                            stat.attributionRate >= 25 ? 'bg-yellow-50' :
                            'bg-gray-50'
                          }`}>
                            <span className={`font-semibold ${
                              stat.attributionRate >= 50 ? 'text-blue-600' :
                              stat.attributionRate >= 25 ? 'text-yellow-600' :
                              'text-gray-600'
                            }`}>
                              {stat.attributionRate}%
                            </span>
                            <span className="text-xs text-gray-600">
                              ({stat.receivedCount}/{stat.interestCount})
                            </span>
                          </div>
                        </td>
                      </tr>
                  ))}
                </tbody>
              </table>

              {userStats.length === 0 && (
                <div className="text-center py-4 text-gray-500 text-sm">
                  Aucune participation enregistrée
                </div>
              )}
            </div>

            {/* Légende réduite */}
            <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
              <span className="text-green-600">●</span> Faible demande (privilégier) | 
              <span className="text-orange-600 ml-2">●</span> Demande moyenne | 
              <span className="text-red-600 ml-2">●</span> Forte demande
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParticipationPanel;