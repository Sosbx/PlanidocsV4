import React, { useState, useEffect } from 'react';
import { format, getDaysInMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getMonthsInRange, isGrayedOut } from '../../utils/dateUtils';
import type { ShiftAssignment, Selections, ShiftExchange, ShiftReplacement } from '../../types/planning';
import { getDesiderata } from '../../lib/firebase/desiderata';
import { useBagPhase } from '../../context/shiftExchange';
import { usePlanningPeriod } from '../../context/planning';
import { addShiftExchange, getShiftExchanges, removeShiftExchange } from '../../lib/firebase/shifts';
import { getReplacementsForUser } from '../../lib/firebase/replacements';
import CommentModal from '../../components/CommentModal';
import ExchangeModal from '../exchange/ExchangeModal';
import Portal from '../../components/Portal';
import { useAuth } from '../../features/auth/hooks';
import { useDirectExchange } from '../../hooks/exchange/useDirectExchange';
import Toast from '../Toast';
import Badge from '../common/Badge';
import { OperationType } from '../../types/exchange';

interface GeneratedPlanningTableProps {
  startDate: Date;
  endDate: Date;
  assignments: Record<string, ShiftAssignment>;
  userId?: string;
  showDesiderata?: boolean;
  receivedShifts?: Record<string, { 
    originalUserId: string; 
    newUserId: string; 
    isPermutation: boolean;
    shiftType: string;
    timeSlot: string;
  }>;
  isAdminView?: boolean;
  viewMode?: 'multiColumn' | 'singleColumn';
}

const GeneratedPlanningTable: React.FC<GeneratedPlanningTableProps> = ({
  startDate,
  endDate,
  assignments,
  userId,
  showDesiderata = false,
  receivedShifts = {},
  isAdminView = false,
  viewMode = 'multiColumn'
}) => {
  const months = getMonthsInRange(startDate, endDate);
  const { user } = useAuth();
  const { config: bagPhaseConfig } = useBagPhase();
  const { isInCurrentPeriod } = usePlanningPeriod();
  const [selectedCell, setSelectedCell] = useState<{
    key: string;
    position: { x: number; y: number };
    assignment: ShiftAssignment;
  } | null>(null);
  const [selectedDirectExchangeCell, setSelectedDirectExchangeCell] = useState<{
    key: string;
    position: { x: number; y: number };
    assignment: ShiftAssignment;
  } | null>(null);
  const { proposeDirectExchange, proposeDirectCession, proposeDirectReplacement, removeExchange } = useDirectExchange({
    onSuccess: (message) => setToast({ visible: true, message, type: 'success' }),
    onError: (message) => setToast({ visible: true, message, type: 'error' })
  });
  const [desiderata, setDesiderata] = useState<Selections>({});
  const [exchanges, setExchanges] = useState<Record<string, ShiftExchange>>({});
  const [replacements, setReplacements] = useState<Record<string, ShiftReplacement>>({});
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({ 
    visible: false, 
    message: '', 
    type: 'success' 
  });

  // Charger les gardes proposées à l'échange
  useEffect(() => {
    const loadExchanges = async () => {
      try {
        const data = await getShiftExchanges();
        // Convertir les échanges en un objet avec les clés au format "YYYY-MM-DD-PERIOD"
        const exchangesMap = data.reduce((acc, exchange) => {
          acc[`${exchange.date}-${exchange.period}`] = exchange;
          return acc;
        }, {} as Record<string, ShiftExchange>);
        setExchanges(exchangesMap);
      } catch (error) {
        console.error('Error loading exchanges:', error);
        setToast({
          visible: true,
          message: 'Erreur lors du chargement des échanges',
          type: 'error'
        });
      }
    };

    loadExchanges();
  }, []);

  // Charger les remplacements proposés
  useEffect(() => {
    if (!user) return;

    const loadReplacements = async () => {
      try {
        const data = await getReplacementsForUser(user.id);
        // Convertir les remplacements en un objet avec les clés au format "YYYY-MM-DD-PERIOD"
        const replacementsMap = data.reduce((acc, replacement) => {
          acc[`${replacement.date}-${replacement.period}`] = replacement;
          return acc;
        }, {} as Record<string, ShiftReplacement>);
        setReplacements(replacementsMap);
      } catch (error) {
        console.error('Error loading replacements:', error);
      }
    };

    loadReplacements();
  }, [user]);

  const handleCellClick = (event: React.MouseEvent, cellKey: string, assignment: ShiftAssignment) => {
    if (!assignment) return;
    
    // Extraire la date et la période du cellKey
    const [year, month, day, period] = cellKey.split('-');
    const formattedDate = `${year}-${month}-${day}`;
    const dateObj = new Date(`${year}-${month}-${day}`);
    
    // Vérifier si la date est dans la période courante
    const isCurrentPeriodDate = isInCurrentPeriod(dateObj);
    
    // En Phase 2 (distribution) - désactiver les interactions pour les utilisateurs
    if (bagPhaseConfig.phase === 'distribution' && !isAdminView) {
      setToast({
        visible: true,
        message: 'La répartition des gardes est en cours. Veuillez patienter.',
        type: 'info'
      });
      return;
    }
    
    // En Phase 3 (completed) - vérifier si la garde est dans la période courante
    if (bagPhaseConfig.phase === 'completed' && !isAdminView) {
      if (isCurrentPeriodDate) {
        // Si la garde est dans la période courante, ouvrir le modal d'échange direct
        setSelectedDirectExchangeCell({
          key: cellKey,
          position: { x: event.clientX, y: event.clientY },
          assignment: {
            ...assignment,
            date: formattedDate,
            period: period as 'M' | 'AM' | 'S'
          }
        });
      } else {
        // Si la garde n'est pas dans la période courante, afficher un message
        setToast({
          visible: true,
          message: 'La période d\'échange est terminée pour cette garde.',
          type: 'info'
        });
      }
      return;
    }
    
    // En Phase 1 (submission) ou en mode admin, permettre l'ouverture du modal
    setSelectedCell({
      key: cellKey,
      position: { x: event.clientX, y: event.clientY },
      assignment: {
        ...assignment,
        date: formattedDate,
        period: period as 'M' | 'AM' | 'S'
      }
    });
  };
  
  // Fonction pour gérer la soumission d'un échange direct
  const handleDirectExchangeSubmit = async (comment: string, operationTypes: OperationType[]) => {
    if (!user || !selectedDirectExchangeCell) return;
    
    const { assignment } = selectedDirectExchangeCell;
    
    try {
      // Pour l'instant, nous ne gérons que le premier type d'opération sélectionné
      // À l'avenir, nous pourrons implémenter la gestion de plusieurs types simultanément
      if (operationTypes.length > 0) {
        const primaryOperationType = operationTypes[0];
        if (primaryOperationType === 'exchange') {
          await proposeDirectExchange(assignment, comment);
        } else if (primaryOperationType === 'give') {
          await proposeDirectCession(assignment, comment);
        } else {
          await proposeDirectReplacement(assignment, comment);
        }
        
        setToast({
          visible: true,
          message: primaryOperationType === 'exchange' 
            ? 'Proposition d\'échange direct ajoutée avec succès' 
            : primaryOperationType === 'give'
              ? 'Proposition de cession ajoutée avec succès'
              : 'Proposition aux remplaçants ajoutée avec succès',
          type: 'success'
        });
      }
    } catch (error) {
      console.error('Error proposing direct exchange:', error);
      setToast({
        visible: true,
        message: 'Erreur lors de l\'ajout de la proposition',
        type: 'error'
      });
    }
    
    setSelectedDirectExchangeCell(null);
  };

  // Charger les desiderata pour affichage en superposition
  useEffect(() => {
    if (!user || !showDesiderata) return;

    const loadDesiderata = async () => {
      try {
        const data = await getDesiderata(user.id);
        if (data?.selections) {
          setDesiderata(data.selections);
        }
      } catch (error) {
        console.error('Error loading desiderata:', error);
      }
    };

    loadDesiderata();
  }, [user, showDesiderata]);

  const handleAddToExchange = async (comment: string) => {
    if (!user || !selectedCell) return;
    
    // Vérifier si on est en phase de soumission
    if (bagPhaseConfig.phase !== 'submission') {
      setToast({
        visible: true,
        message: bagPhaseConfig.phase === 'distribution' 
          ? 'La répartition des gardes est en cours. Veuillez patienter.' 
          : 'La période d\'échange est terminée.',
        type: 'info'
      });
      setSelectedCell(null);
      return;
    }
    
    const { date, period, shiftType, timeSlot } = selectedCell.assignment;
    
    try {
      // Ajouter immédiatement à l'état local pour une UI réactive
      setExchanges(prev => ({
        ...prev,
        [`${date}-${period}`]: { 
          id: `temp-${Date.now()}`, 
          userId: user.id,
          date,
          period: period as 'M' | 'AM' | 'S',
          shiftType,
          timeSlot,
          comment,
          createdAt: new Date().toISOString(),
          status: 'pending',
          interestedUsers: [],
          lastModified: new Date().toISOString()
        }
      }));

      await addShiftExchange({
        userId: user.id || '',
        date,
        period: period as 'M' | 'AM' | 'S',
        shiftType,
        timeSlot,
        comment: comment || '',
        status: 'pending',
        lastModified: new Date().toISOString()
      });
      
      // Mettre à jour l'état avec les données fraîches
      const refreshedExchanges = await getShiftExchanges();
      const exchangesMap = refreshedExchanges.reduce((acc, exchange) => {
        acc[`${exchange.date}-${exchange.period}`] = exchange;
        return acc;
      }, {} as Record<string, ShiftExchange>);
      setExchanges(exchangesMap);
      
      setToast({
        visible: true,
        message: 'Garde ajoutée à la bourse aux gardes',
        type: 'success'
      });
    } catch (error) {
      // En cas d'erreur, retirer de l'état local
      setExchanges(prev => {
        const newState = { ...prev };
        delete newState[`${date}-${period}`];
        return newState;
      });
      
      console.error('Error adding to exchange:', error);
      setToast({
        visible: true,
        message: 'Erreur lors de l\'ajout à la bourse aux gardes',
        type: 'error'
      });
    }
    
    setSelectedCell(null);
  };

  const handleRemoveFromExchange = async () => {
    if (!selectedCell || !user) return;
    
    // Vérifier si on est en phase de soumission
    if (bagPhaseConfig.phase !== 'submission') {
      setToast({
        visible: true,
        message: bagPhaseConfig.phase === 'distribution' 
          ? 'La répartition des gardes est en cours. Veuillez patienter.' 
          : 'La période d\'échange est terminée.',
        type: 'info'
      });
      setSelectedCell(null);
      return;
    }
    
    const { date, period } = selectedCell.assignment;
    const key = `${date}-${period}`;
    const exchange = exchanges[key];
    
    if (!exchange) {
      setSelectedCell(null);
      return;
    }
    
    // Vérifier que l'utilisateur est propriétaire de cette garde
    if (exchange.userId !== user.id) {
      setToast({
        visible: true,
        message: 'Vous ne pouvez pas retirer une garde qui ne vous appartient pas',
        type: 'error'
      });
      setSelectedCell(null);
      return;
    }
    
    try {
      // Mettre à jour l'état local immédiatement
      setExchanges(prev => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      });
      
      await removeShiftExchange(exchange.id);
      
      // Rafraîchir la liste des échanges
      const refreshedExchanges = await getShiftExchanges();
      const exchangesMap = refreshedExchanges.reduce((acc, exchange) => {
        acc[`${exchange.date}-${exchange.period}`] = exchange;
        return acc;
      }, {} as Record<string, ShiftExchange>);
      setExchanges(exchangesMap);
      
      setToast({
        visible: true,
        message: 'Garde retirée de la bourse aux gardes',
        type: 'success'
      });
    } catch (error) {
      console.error('Error removing from exchange:', error);
      
      // Restaurer l'état en cas d'erreur
      const refreshedExchanges = await getShiftExchanges();
      const exchangesMap = refreshedExchanges.reduce((acc, exchange) => {
        acc[`${exchange.date}-${exchange.period}`] = exchange;
        return acc;
      }, {} as Record<string, ShiftExchange>);
      setExchanges(exchangesMap);
      
      setToast({
        visible: true,
        message: 'Erreur lors du retrait de la garde',
        type: 'error'
      });
    }
    
    setSelectedCell(null);
  };

  const renderMonthTable = (month: Date) => {
    // Créer un tableau de tous les jours du mois
    const days = Array.from(
      { length: getDaysInMonth(month) },
      (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)
    );

    // Filtrer les jours pour n'inclure que ceux dans la plage de dates
    const filteredDays = days.filter(date => {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const compareStart = new Date(startDate);
      compareStart.setHours(0, 0, 0, 0);
      
      const compareEnd = new Date(endDate);
      compareEnd.setHours(0, 0, 0, 0);
      
      return startOfDay >= compareStart && startOfDay <= compareEnd;
    });

    return (
      <div key={month.getTime()} className="inline-block align-top mr-4 mb-4">
        <table className="border border-gray-200 bg-white">
          <thead>
            <tr>
              <th colSpan={4} className="px-3 py-2 text-xs font-medium text-gray-500 border-b bg-gray-50/70">
                {format(month, 'MMMM', { locale: fr }).charAt(0).toUpperCase() + format(month, 'MMMM', { locale: fr }).slice(1) + ' ' + format(month, 'yyyy')}
              </th>
            </tr>
            <tr className="bg-gray-50/70">
              <th className="border px-2 py-1 text-xs font-normal text-gray-500 w-16">Jour</th>
              <th className="border px-2 py-1 text-xs font-semibold text-gray-600 w-12">M</th>
              <th className="border px-2 py-1 text-xs font-semibold text-gray-600 w-12">AM</th>
              <th className="border px-2 py-1 text-xs font-semibold text-gray-600 w-12">S</th>
            </tr>
          </thead>
          <tbody>
            {filteredDays.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const grayedOut = isGrayedOut(day);
              return (
                <tr key={dateStr}>
                  <td className={`border px-2 py-1 text-[11px] ${grayedOut ? 'text-gray-400 bg-gray-50/50' : 'text-gray-500 bg-gray-50/30'}`}>
                    <div className="flex justify-start items-center">
                      <span>{format(day, 'd', { locale: fr })}</span>
                      <span className="text-gray-400 text-[10px] ml-1">
                        {format(day, 'EEEEEE', { locale: fr }).charAt(0).toUpperCase() + format(day, 'EEEEEE', { locale: fr }).slice(1).toLowerCase()}
                      </span>
                    </div>
                  </td>
                  {['M', 'AM', 'S'].map(period => {
                    const cellKey = `${dateStr}-${period}`;
                    const exchange = exchanges[cellKey];
                    const replacement = replacements[cellKey];
                    
                    // Vérifier si la cellule représente une garde reçue via un échange
                    const key = `${dateStr}-${period}`;
                    const receivedShift = receivedShifts[key];
                    
                    // Nouvelle condition pour les permutations : si c'est une permutation,
                    // les deux utilisateurs doivent voir leur garde en vert
                    const isReceivedShift = receivedShift && (
                      receivedShift.newUserId === userId || 
                      (receivedShift.isPermutation && receivedShift.originalUserId === userId)
                    );
                    
                    // Pour afficher différemment les permutations
                    const isReceivedPermutation = isReceivedShift && receivedShift.isPermutation;
                    
                    // Récupérer l'assignment de base ou la garde reçue
                    let cellAssignment = assignments[cellKey];
                    
                    // Si la garde a été donnée via un échange simple (non permutation), ne rien afficher
                    if (receivedShift && receivedShift.originalUserId === userId && !receivedShift.isPermutation && !cellAssignment) {
                      return (
                        <td key={cellKey} className="border px-1 py-1 text-xs text-center"></td>
                      );
                    }
                    
                    // Si aucune garde assignée mais c'est une garde reçue, créer un assignment temporaire
                    if (!cellAssignment && isReceivedShift) {
                      cellAssignment = {
                        type: period as 'M' | 'AM' | 'S',
                        date: dateStr,
                        timeSlot: receivedShift.timeSlot,
                        shiftType: receivedShift.shiftType
                      };
                    }
                    
                    // Variables pour le style
                    const desideratum = showDesiderata ? desiderata[cellKey] : null;
                    const hasProposedGuard = exchange && exchange.userId === userId && !isReceivedShift;
                    const isProposedToReplacements = replacement && replacement.originalUserId === userId;
                    
                    // Styles spécifiques aux gardes reçues
                    const interestedCount = exchange?.interestedUsers?.length || 0;
                    
                    // Construire les classes de fond
                    const bgClasses = [
                      // En phase completed, on n'affiche plus les fonds de couleur pour les desiderata et les gardes proposées
                      bagPhaseConfig.phase !== 'completed' && showDesiderata && desideratum?.type ? 
                        desideratum.type === 'primary' ? 
                          grayedOut ? 'bg-red-200' : 'bg-red-100'
                          : grayedOut ? 'bg-blue-200' : 'bg-blue-100'
                        : '',
                      !desideratum?.type && grayedOut ? 'bg-gray-100' : '',
                      !desideratum?.type && isReceivedShift ? 
                        isReceivedPermutation ? 'bg-emerald-100' : 'bg-green-100' 
                        : '',
                      // Ne pas afficher le fond jaune pour les gardes proposées en phase completed
                      bagPhaseConfig.phase !== 'completed' && hasProposedGuard && !isReceivedShift ? 'bg-yellow-100' : '',
                      // Toujours afficher le fond ambre pour les gardes proposées aux remplaçants
                      isProposedToReplacements ? 'bg-amber-100' : '',
                      cellAssignment ? 'hover:bg-opacity-75' : ''
                    ].filter(Boolean).join(' ');

                    return (
                      <td
                        key={cellKey}
                        className={`border px-1 py-1 text-xs text-center relative transition-colors ${bgClasses} ${
                          cellAssignment && bagPhaseConfig.phase === 'submission' ? 'cursor-pointer hover:bg-gray-50' : ''
                        } ${
                          showDesiderata && desideratum?.type ? 'z-10' : ''
                        }`}
                        title={cellAssignment ? `${cellAssignment.shiftType} - ${cellAssignment.timeSlot}${isReceivedShift ? isReceivedPermutation ? ' (Garde permutée)' : ' (Garde reçue via la bourse)' : ''}${isProposedToReplacements ? ' (Proposée aux remplaçants)' : ''}` : ''}
                        onClick={(e) => !isAdminView && cellAssignment && handleCellClick(e, cellKey, cellAssignment)}
                      >
                        <div className="relative">
                          <span className={`
                            font-semibold text-[13px] 
                            ${period === 'M' 
                              ? 'text-amber-800' 
                              : period === 'AM' 
                                ? 'text-blue-800' 
                                : 'text-violet-800'
                            }
                            ${hasProposedGuard ? 'drop-shadow-sm' : ''}
                            ${isReceivedShift ? 'drop-shadow-sm' : ''}
                          `}>
                            {cellAssignment?.shiftType || ''}
                          </span>
                          
                          {/* Utiliser notre nouveau composant Badge pour les pastilles */}
                          {isProposedToReplacements ? (
                            <span className="absolute -top-2 -right-2">
                              <Badge type="replacement" size="sm" />
                            </span>
                          ) : (
                            bagPhaseConfig.phase !== 'completed' && hasProposedGuard && interestedCount > 0 && !isReceivedShift && (
                              <span className="absolute -top-2 -right-2">
                                <Badge type="interested" count={interestedCount} size="sm" />
                              </span>
                            )
                          )}
                          
                          {/* Afficher un badge pour les gardes proposées à l'échange */}
                          {bagPhaseConfig.phase !== 'completed' && hasProposedGuard && interestedCount === 0 && !isReceivedShift && (
                            <span className="absolute -top-2 -right-2">
                              <Badge type="exchange" size="sm" />
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderSingleColumnView = () => (
    <div className="overflow-y-auto overflow-x-hidden whitespace-normal">
      {months.map((month) => (
        <div key={month.getTime()} className="mb-8">
          <h3 className="text-lg font-medium text-gray-700 mb-2">
            {format(month, 'MMMM', { locale: fr }).charAt(0).toUpperCase() + format(month, 'MMMM', { locale: fr }).slice(1) + ' ' + format(month, 'yyyy')}
          </h3>
          <table className="w-full border border-gray-200 bg-white">
            <thead>
              <tr className="bg-gray-50/70">
                <th className="border px-2 py-1 text-xs font-normal text-gray-500 w-1/4">Jour</th>
                <th className="border px-2 py-1 text-xs font-semibold text-gray-600 w-1/4">M</th>
                <th className="border px-2 py-1 text-xs font-semibold text-gray-600 w-1/4">AM</th>
                <th className="border px-2 py-1 text-xs font-semibold text-gray-600 w-1/4">S</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(
                { length: getDaysInMonth(month) },
                (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)
              )
                .filter(date => {
                  const startOfDay = new Date(date);
                  startOfDay.setHours(0, 0, 0, 0);
                  
                  const compareStart = new Date(startDate);
                  compareStart.setHours(0, 0, 0, 0);
                  
                  const compareEnd = new Date(endDate);
                  compareEnd.setHours(0, 0, 0, 0);
                  
                  return startOfDay >= compareStart && startOfDay <= compareEnd;
                })
                .map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const grayedOut = isGrayedOut(day);
                  return (
                    <tr key={dateStr}>
                      <td className={`border px-2 py-1 text-xs ${grayedOut ? 'text-gray-400 bg-gray-50/50' : 'text-gray-500 bg-gray-50/30'}`}>
                        <div className="flex justify-start items-center">
                          <span>{format(day, 'd', { locale: fr })}</span>
                          <span className="text-gray-400 text-[10px] ml-1">
                            {format(day, 'EEEE', { locale: fr }).substring(0, 1).toUpperCase() + format(day, 'EEEE', { locale: fr }).substring(1, 3).toLowerCase()}
                          </span>
                        </div>
                      </td>
                      {['M', 'AM', 'S'].map(period => {
                        const cellKey = `${dateStr}-${period}`;
                        const exchange = exchanges[cellKey];
                        const replacement = replacements[cellKey];
                        
                        // Vérifier si la cellule représente une garde reçue via un échange
                        const key = `${dateStr}-${period}`;
                        const receivedShift = receivedShifts[key];
                        
                        const isReceivedShift = receivedShift && (
                          receivedShift.newUserId === userId || 
                          (receivedShift.isPermutation && receivedShift.originalUserId === userId)
                        );
                        
                        const isReceivedPermutation = isReceivedShift && receivedShift.isPermutation;
                        
                        let cellAssignment = assignments[cellKey];
                        
                        if (receivedShift && receivedShift.originalUserId === userId && !receivedShift.isPermutation && !cellAssignment) {
                          return (
                            <td key={cellKey} className="border px-1 py-1 text-xs text-center"></td>
                          );
                        }
                        
                        if (!cellAssignment && isReceivedShift) {
                          cellAssignment = {
                            type: period as 'M' | 'AM' | 'S',
                            date: dateStr,
                            timeSlot: receivedShift.timeSlot,
                            shiftType: receivedShift.shiftType
                          };
                        }
                        
                        const desideratum = showDesiderata ? desiderata[cellKey] : null;
                        const hasProposedGuard = exchange && exchange.userId === userId && !isReceivedShift;
                        const isProposedToReplacements = replacement && replacement.originalUserId === userId;
                        
                        const interestedCount = exchange?.interestedUsers?.length || 0;
                        
                        const bgClasses = [
                          // En phase completed, on n'affiche plus les fonds de couleur pour les desiderata et les gardes proposées
                          bagPhaseConfig.phase !== 'completed' && showDesiderata && desideratum?.type ? 
                            desideratum.type === 'primary' ? 
                              grayedOut ? 'bg-red-200' : 'bg-red-100'
                              : grayedOut ? 'bg-blue-200' : 'bg-blue-100'
                            : '',
                          !desideratum?.type && grayedOut ? 'bg-gray-100' : '',
                          !desideratum?.type && isReceivedShift ? 
                            isReceivedPermutation ? 'bg-emerald-100' : 'bg-green-100' 
                            : '',
                          // Ne pas afficher le fond jaune pour les gardes proposées en phase completed
                          bagPhaseConfig.phase !== 'completed' && hasProposedGuard && !isReceivedShift ? 'bg-yellow-100' : '',
                          // Toujours afficher le fond ambre pour les gardes proposées aux remplaçants
                          isProposedToReplacements ? 'bg-amber-100' : '',
                          cellAssignment ? 'hover:bg-opacity-75' : ''
                        ].filter(Boolean).join(' ');

                        return (
                          <td
                            key={cellKey}
                            className={`border px-1 py-1 text-xs text-center relative transition-colors ${bgClasses} ${
                              cellAssignment && bagPhaseConfig.phase === 'submission' ? 'cursor-pointer hover:bg-gray-50' : ''
                            } ${
                              showDesiderata && desideratum?.type ? 'z-10' : ''
                            }`}
                            title={cellAssignment ? `${cellAssignment.shiftType} - ${cellAssignment.timeSlot}${isReceivedShift ? isReceivedPermutation ? ' (Garde permutée)' : ' (Garde reçue via la bourse)' : ''}${isProposedToReplacements ? ' (Proposée aux remplaçants)' : ''}` : ''}
                            onClick={(e) => !isAdminView && cellAssignment && handleCellClick(e, cellKey, cellAssignment)}
                          >
                            <div className="relative">
                              <span className={`
                                font-semibold text-[13px] 
                                ${period === 'M' 
                                  ? 'text-amber-800' 
                                  : period === 'AM' 
                                    ? 'text-blue-800' 
                                    : 'text-violet-800'
                                }
                                ${hasProposedGuard ? 'drop-shadow-sm' : ''}
                                ${isReceivedShift ? 'drop-shadow-sm' : ''}
                              `}>
                                {cellAssignment?.shiftType || ''}
                              </span>
                              {/* Afficher soit la pastille d'intérêt, soit la pastille de remplacement */}
                              {isProposedToReplacements ? (
                                <span className="absolute -top-2 -right-2">
                                  <Badge type="replacement" size="sm" />
                                </span>
                              ) : (
                                bagPhaseConfig.phase !== 'completed' && hasProposedGuard && interestedCount > 0 && !isReceivedShift && (
                                  <span className="absolute -top-2 -right-2">
                                    <Badge type="interested" count={interestedCount} size="sm" />
                                  </span>
                                )
                              )}
                              
                              {/* Afficher un badge pour les gardes proposées à l'échange */}
                              {bagPhaseConfig.phase !== 'completed' && hasProposedGuard && interestedCount === 0 && !isReceivedShift && (
                                <span className="absolute -top-2 -right-2">
                                  <Badge type="exchange" size="sm" />
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {viewMode === 'multiColumn' ? (
        <div className="overflow-x-auto whitespace-nowrap">
          {months.map(renderMonthTable)}
        </div>
      ) : (
        renderSingleColumnView()
      )}

      {selectedCell && (
        <Portal>
          <CommentModal
            isOpen={true}
            onClose={() => setSelectedCell(null)}
            onExchange={!isAdminView ? handleAddToExchange : undefined}
            onRemoveExchange={!isAdminView ? handleRemoveFromExchange : undefined}
            onSave={() => setSelectedCell(null)}
            initialComment=""
            position={selectedCell.position}
            cellKey={selectedCell.key}
            readOnly={isAdminView}
          />
        </Portal>
      )}
      
      {selectedDirectExchangeCell && (
        <Portal>
          <ExchangeModal
            isOpen={true}
            onClose={() => setSelectedDirectExchangeCell(null)}
            onSubmit={handleDirectExchangeSubmit}
            initialComment=""
            position={selectedDirectExchangeCell.position}
            assignment={selectedDirectExchangeCell.assignment}
            exchangeType="direct"
            showReplacementOption={true}
          />
        </Portal>
      )}

      <Toast 
        message={toast.message}
        isVisible={toast.visible}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, visible: false }))}
      />
    </>
  );
};

export default GeneratedPlanningTable;
