import React, { useState, useMemo } from 'react';
import { formatParisDate } from '@/utils/timezoneUtils';
import { format } from 'date-fns';
import { frLocale } from '../../../../utils/dateLocale';
import { X, AlertTriangle, UserPlus, TrendingUp, TrendingDown } from 'lucide-react';
import { proposeToReplacements, cancelPropositionToReplacements } from '../../../../lib/firebase/exchange';
import type { BagPhaseConfig, ShiftAssignment } from '../../../../types/planning';
import type { ShiftExchange as PlanningShiftExchange } from '../../../../types/planning';
import type { ShiftExchange as FeatureShiftExchange } from '../../types';

// Type union pour accepter les deux types de ShiftExchange
type ShiftExchange = PlanningShiftExchange | FeatureShiftExchange;
import type { User } from '../../../../types/users';
import { isGrayedOut } from '../../../../utils/dateUtils';
import InterestedUserCard from './InterestedUserCard';
import { ConfirmationModal } from '../../../../components/modals';
import '../../../../styles/BadgeStyles.css';

interface ExchangeListProps {
  exchanges: ShiftExchange[]; // Utiliser le type union défini plus haut
  users: User[];
  bagPhaseConfig: BagPhaseConfig;
  conflictStates: Record<string, Record<string, boolean>>;
  conflictShiftTypes?: Record<string, Record<string, string>>;
  userAssignments: Record<string, Record<string, ShiftAssignment>>;
  onValidateExchange: (exchangeId: string, interestedUserId: string, hasConflict: boolean) => void;
  onRejectExchange: (exchangeId: string) => void;
  onRemoveUser: (exchangeId: string, userId: string) => void;
  history: any[]; // Added history prop
  selectedForReplacements?: Set<string>;
  onSelectedForReplacementsChange?: (selected: Set<string>) => void;
  filterPeriod?: 'all' | 'M' | 'AM' | 'S';
  showOnlyWithInterested?: boolean;
  filterUserId?: string;
}

const periodNames = {
  'M': 'Matin',
  'AM': 'Après-midi',
  'S': 'Soir'
};

const ExchangeList: React.FC<ExchangeListProps> = ({
  exchanges,
  users,
  bagPhaseConfig,
  conflictStates,
  conflictShiftTypes,
  userAssignments,
  onValidateExchange,
  onRejectExchange,
  onRemoveUser,
  history, // Added history prop
  selectedForReplacements: externalSelected,
  onSelectedForReplacementsChange,
  filterPeriod = 'all',
  showOnlyWithInterested = false,
  filterUserId = ''
}) => {
  const [showRejectConfirmation, setShowRejectConfirmation] = useState(false);
  const [exchangeToReject, setExchangeToReject] = useState<string | null>(null);
  const [proposingToReplacements, setProposingToReplacements] = useState<string | null>(null);
  const [selectedForReplacements, setSelectedForReplacements] = useState<Set<string>>(
    externalSelected || new Set()
  );
  
  // États pour le tri des colonnes
  const [sortColumn, setSortColumn] = useState<'date' | 'doctor' | 'type' | 'interested'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleRejectClick = (exchangeId: string) => {
    setExchangeToReject(exchangeId);
    setShowRejectConfirmation(true);
  };

  const handleConfirmReject = () => {
    if (exchangeToReject) {
      onRejectExchange(exchangeToReject);
      setShowRejectConfirmation(false);
      setExchangeToReject(null);
    }
  };

  const toggleReplacementSelection = (exchangeId: string) => {
    const newSelection = new Set(selectedForReplacements);
    if (newSelection.has(exchangeId)) {
      newSelection.delete(exchangeId);
    } else {
      newSelection.add(exchangeId);
    }
    setSelectedForReplacements(newSelection);
    
    // Notifier le parent si la fonction callback est fournie
    if (onSelectedForReplacementsChange) {
      onSelectedForReplacementsChange(newSelection);
    }
  };

  const handleProposeToReplacements = async (exchange: ShiftExchange) => {
    try {
      setProposingToReplacements(exchange.id);
      
      if (exchange.proposedToReplacements) {
        // Retirer la proposition
        await cancelPropositionToReplacements(exchange as PlanningShiftExchange);
        alert(`La garde du ${formatParisDate(new Date(exchange.date), 'dd/MM/yyyy')} (${exchange.period}) a été retirée de la liste des remplaçants.`);
      } else {
        // Proposer aux remplaçants
        await proposeToReplacements(exchange as PlanningShiftExchange);
        alert(`La garde du ${formatParisDate(new Date(exchange.date), 'dd/MM/yyyy')} (${exchange.period}) a été proposée aux remplaçants.`);
      }
    } catch (error) {
      console.error('Error proposing/canceling to replacements:', error);
      alert('Une erreur est survenue lors de l\'opération.');
    } finally {
      setProposingToReplacements(null);
    }
  };

  // Fonction pour vérifier si une garde est éligible pour être proposée aux remplaçants
  const isEligibleForReplacement = (exchange: ShiftExchange) => {
    // Vérifier si la garde est en attente et que la date limite est dépassée
    // OU si elle est déjà proposée aux remplaçants (pour permettre de retirer la proposition)
    return (exchange.status === 'pending' && 
           (exchange.interestedUsers?.length === 0 || exchange.interestedUsers?.length === 0) &&
           bagPhaseConfig.phase === 'distribution') ||
           exchange.proposedToReplacements;
  };

  // Fonction pour gérer le clic sur une colonne triable
  const handleSort = (column: 'date' | 'doctor' | 'type' | 'interested') => {
    if (sortColumn === column) {
      // Si on clique sur la même colonne, inverser la direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Si on clique sur une nouvelle colonne, la définir avec direction ascendante
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Filtrer et trier les échanges
  const sortedExchanges = useMemo(() => {
    // D'abord filtrer par période si nécessaire
    let filtered = filterPeriod === 'all' 
      ? exchanges 
      : exchanges.filter(exchange => exchange.period === filterPeriod);
    
    // Ensuite filtrer par intéressés si nécessaire
    if (showOnlyWithInterested) {
      filtered = filtered.filter(exchange => 
        exchange.interestedUsers && exchange.interestedUsers.length > 0
      );
    }
    
    // Filtrer par utilisateur si nécessaire
    if (filterUserId) {
      filtered = filtered.filter(exchange => 
        // L'utilisateur est le propriétaire de la garde
        exchange.userId === filterUserId ||
        // OU l'utilisateur est dans la liste des intéressés
        (exchange.interestedUsers && exchange.interestedUsers.includes(filterUserId))
      );
    }
    
    // Ensuite trier
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortColumn) {
        case 'date':
          comparison = a.date.localeCompare(b.date);
          break;
          
        case 'doctor':
          const userA = users.find(u => u.id === a.userId);
          const userB = users.find(u => u.id === b.userId);
          const nameA = userA?.lastName || '';
          const nameB = userB?.lastName || '';
          comparison = nameA.localeCompare(nameB);
          break;
          
        case 'type':
          comparison = a.shiftType.localeCompare(b.shiftType);
          break;
          
        case 'interested':
          const countA = a.interestedUsers?.length || 0;
          const countB = b.interestedUsers?.length || 0;
          comparison = countB - countA; // Inversé pour avoir les plus intéressés en premier
          break;
      }
      
      // Appliquer la direction
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [exchanges, sortColumn, sortDirection, users, filterPeriod, showOnlyWithInterested, filterUserId]);

  if (sortedExchanges.length === 0) {
    return (
      <div className="p-6">
        <p className="text-gray-500 text-center">
          Aucune garde n'est actuellement disponible à l'échange
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Version desktop */}
      <div className="hidden md:block">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                scope="col" 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('doctor')}
              >
                <div className="w-20 flex items-center gap-1">
                  Médecin
                  {sortColumn === 'doctor' && (
                    sortDirection === 'asc' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />
                  )}
                </div>
              </th>
              <th 
                scope="col" 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('date')}
              >
                <div className="w-24 flex items-center gap-1">
                  Date
                  {sortColumn === 'date' && (
                    sortDirection === 'asc' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />
                  )}
                </div>
              </th>
              <th 
                scope="col" 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('type')}
              >
                <div className="w-20 flex items-center gap-1">
                  Garde
                  {sortColumn === 'type' && (
                    sortDirection === 'asc' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />
                  )}
                </div>
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="w-32">Commentaire</div>
              </th>
              <th 
                scope="col" 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('interested')}
              >
                <div className="w-32 flex items-center gap-1">
                  Intéressés
                  {sortColumn === 'interested' && (
                    sortDirection === 'asc' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />
                  )}
                </div>
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="w-16">Actions</div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedExchanges.map(exchange => {
              const exchangeUser = users.find(u => u.id === exchange.userId);
              const date = new Date(exchange.date);
              const isWeekendOrHoliday = isGrayedOut(date);
              const interestedUsers = exchange.interestedUsers || [];
              const isUnavailable = exchange.status === 'unavailable';

              return (
                <tr key={exchange.id} className={`
                  ${isWeekendOrHoliday ? 'bg-red-50/30' : ''} 
                  ${isUnavailable ? 'bg-gray-100' : 'hover:bg-gray-50'}
                `}>
                  <td className={`px-4 py-4 whitespace-nowrap ${isUnavailable ? 'text-gray-400 line-through' : ''}`}>
                    <div className="flex flex-col">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-900">
                          {exchangeUser?.lastName.toUpperCase() || 'INCONNU'}
                          {history?.length > 0 && exchangeUser && exchanges.filter(e => e.interestedUsers?.includes(exchangeUser.id)).length > 0 && (
                            <span className="text-xs text-gray-500 ml-1">
                              ({Math.round((history.filter(h => h.newUserId === exchangeUser?.id).length / exchanges.filter(e => e.interestedUsers?.includes(exchangeUser?.id)).length) * 100)}%)
                            </span>
                          )}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {exchangeUser?.firstName || ''}
                      </span>
                    </div>
                  </td>
                  <td className={`px-4 py-4 whitespace-nowrap ${isUnavailable ? 'text-gray-400 line-through' : ''}`}>
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-900">
                        {formatParisDate(date, 'EEE d MMM', { locale: frLocale })}
                      </span>
                      <span className="text-xs text-gray-500">
                        {periodNames[exchange.period]}
                      </span>
                    </div>
                  </td>
                  <td className={`px-4 py-4 whitespace-nowrap ${isUnavailable ? 'text-gray-400 line-through' : ''}`}>
                    <span className={`px-3 py-2 inline-flex text-sm leading-5 font-semibold rounded-lg shadow-sm ${
                      exchange.period === 'M'
                        ? 'badge-morning'
                        : exchange.period === 'AM'
                        ? 'badge-afternoon'
                        : 'badge-evening'
                    }`}>
                      {exchange.shiftType}
                    </span>
                  </td>
                  <td className={`px-4 py-4 ${isUnavailable ? 'text-gray-400 line-through' : ''}`}>
                    <div className="text-sm text-gray-500">
                      {exchange.comment || <span className="text-gray-400 italic">Aucun commentaire</span>}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {isUnavailable ? (
                      <div className="flex items-center text-amber-600">
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        <span className="text-sm">Garde indisponible</span>
                      </div>
                    ) : interestedUsers.length > 0 ? (
                      <div className="space-y-1">
                        {interestedUsers.map(userId => (
                          <InterestedUserCard
                            key={userId}
                            userId={userId}
                            users={users}
                            exchange={exchange}
                            conflictStates={conflictStates}
                            conflictShiftTypes={conflictShiftTypes}
                            userAssignments={userAssignments}
                            bagPhaseConfig={bagPhaseConfig}
                            onValidateExchange={onValidateExchange}
                            onRemoveUser={onRemoveUser}
                            exchanges={exchanges}
                            history={history}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500 italic">
                        Aucun intéressé
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-2">
                      {bagPhaseConfig.phase === 'completed' ? (
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedForReplacements.has(exchange.id)}
                            onChange={() => toggleReplacementSelection(exchange.id)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">Remplaçants</span>
                        </label>
                      ) : (
                        <>
                          <button
                            onClick={() => handleRejectClick(exchange.id)}
                            className={`inline-flex items-center px-2.5 py-1.5 border text-xs font-medium rounded ${
                              bagPhaseConfig.phase !== 'distribution' || isUnavailable
                                ? 'border-gray-300 text-gray-300 bg-gray-50 cursor-not-allowed'
                                : 'border-red-300 text-red-700 bg-white hover:bg-red-50'
                            }`}
                            disabled={bagPhaseConfig.phase !== 'distribution' || isUnavailable}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Rejeter
                          </button>
                          
                          {isEligibleForReplacement(exchange) && (
                            <button
                              onClick={() => handleProposeToReplacements(exchange)}
                              className={`inline-flex items-center px-2.5 py-1.5 border text-xs font-medium rounded ${
                                exchange.proposedToReplacements 
                                  ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                                  : 'border-blue-300 text-blue-700 bg-white hover:bg-blue-50'
                              }`}
                              disabled={proposingToReplacements === exchange.id}
                            >
                              <UserPlus className="h-3 w-3 mr-1" />
                              {exchange.proposedToReplacements 
                                ? 'Rempla' 
                                : proposingToReplacements === exchange.id 
                                  ? 'En cours...' 
                                  : 'Proposer aux remplaçants'}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Version mobile */}
      <div className="md:hidden space-y-4">
        {sortedExchanges.map(exchange => {
          const exchangeUser = users.find(u => u.id === exchange.userId);
          const date = new Date(exchange.date);
          const isWeekendOrHoliday = isGrayedOut(date);
          const interestedUsers = exchange.interestedUsers || [];
          const isUnavailable = exchange.status === 'unavailable';

          return (
            <div key={exchange.id} className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${
              isWeekendOrHoliday ? 'bg-red-50/30' : ''
            } ${isUnavailable ? 'bg-gray-100' : ''}`}>
              {/* En-tête avec date et médecin */}
              <div className={`flex justify-between items-start mb-4 ${isUnavailable ? 'text-gray-400 line-through' : ''}`}>
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {formatParisDate(date, 'EEEE d MMMM', { locale: frLocale })}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {periodNames[exchange.period]}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {exchangeUser?.lastName.toUpperCase() || 'INCONNU'}
                    {history?.length > 0 && exchangeUser && exchanges.filter(e => e.interestedUsers?.includes(exchangeUser.id)).length > 0 && (
                      <span className="text-xs text-gray-500 ml-1">
                        ({Math.round((history.filter(h => h.newUserId === exchangeUser?.id).length / exchanges.filter(e => e.interestedUsers?.includes(exchangeUser?.id)).length) * 100)}%)
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {exchangeUser?.firstName || ''}
                  </div>
                </div>
              </div>

              {/* Garde et commentaire */}
              <div className={`flex items-center justify-between mb-4 ${isUnavailable ? 'text-gray-400 line-through' : ''}`}>
                <span className={`px-3 py-2 inline-flex text-sm leading-5 font-semibold rounded-lg shadow-sm ${
                  exchange.period === 'M'
                    ? 'badge-morning'
                    : exchange.period === 'AM'
                    ? 'badge-afternoon'
                    : 'badge-evening'
                }`}>
                  {exchange.shiftType}
                </span>
                <div className="text-sm text-gray-500">
                  {exchange.comment || <span className="text-gray-400 italic">Aucun commentaire</span>}
                </div>
              </div>

              {/* Garde indisponible */}
              {isUnavailable && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center text-amber-700">
                  <AlertTriangle className="h-5 w-5 mr-2 text-amber-500" />
                  <span>Cette garde est actuellement indisponible</span>
                </div>
              )}

              {/* Intéressés */}
              <div className="space-y-2">
                {interestedUsers.length > 0 && !isUnavailable ? (
                  interestedUsers.map(userId => (
                    <InterestedUserCard
                      key={userId}
                      userId={userId}
                      users={users}
                      exchange={exchange}
                      conflictStates={conflictStates}
                      conflictShiftTypes={conflictShiftTypes}
                      userAssignments={userAssignments}
                      bagPhaseConfig={bagPhaseConfig}
                      onValidateExchange={onValidateExchange}
                      onRemoveUser={onRemoveUser}
                      exchanges={exchanges}
                      history={history}
                    />
                  ))
                ) : !isUnavailable ? (
                  <div className="text-sm text-gray-500 italic text-center py-2">
                    Aucun intéressé
                  </div>
                ) : null}
              </div>

              {/* Actions */}
              {!isUnavailable && (
                <div className="mt-4 flex justify-end gap-2">
                  {bagPhaseConfig.phase === 'completed' ? (
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedForReplacements.has(exchange.id)}
                        onChange={() => toggleReplacementSelection(exchange.id)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Donner aux remplaçants</span>
                    </label>
                  ) : (
                    <>
                      <button
                        onClick={() => handleRejectClick(exchange.id)}
                        className={`inline-flex items-center p-2 border rounded-full ${
                          bagPhaseConfig.phase !== 'distribution'
                            ? 'border-gray-300 text-gray-300 bg-gray-50 cursor-not-allowed'
                            : 'border-red-300 text-red-700 bg-white hover:bg-red-50'
                        }`}
                        disabled={bagPhaseConfig.phase !== 'distribution'}
                        title="Rejeter"
                      >
                        <X className="h-5 w-5" />
                      </button>
                      
                      {isEligibleForReplacement(exchange) && (
                        <button
                          onClick={() => handleProposeToReplacements(exchange)}
                          className={`inline-flex items-center p-2 border rounded-full ${
                            exchange.proposedToReplacements 
                              ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                              : 'border-blue-300 text-blue-700 bg-white hover:bg-blue-50'
                          }`}
                          disabled={proposingToReplacements === exchange.id}
                          title={exchange.proposedToReplacements ? "Retirer de la liste des remplaçants" : "Proposer aux remplaçants"}
                        >
                          <UserPlus className="h-5 w-5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal de confirmation pour le rejet */}
      <ConfirmationModal
        isOpen={showRejectConfirmation}
        title="Rejeter l'échange"
        message="Êtes-vous sûr de vouloir rejeter cet échange ? Cette action est irréversible."
        confirmLabel="Rejeter"
        onConfirm={handleConfirmReject}
        onCancel={() => {
          setShowRejectConfirmation(false);
          setExchangeToReject(null);
        }}
      />
    </div>
  );
};

export default ExchangeList;
