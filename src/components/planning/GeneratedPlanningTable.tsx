import React, { useState, useEffect, useCallback } from 'react';
import { format, getDaysInMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getMonthsInRange, isGrayedOut } from '../../utils/dateUtils';
import type { ShiftAssignment, Selections, ShiftExchange } from '../../types/planning';
import { getDesiderata } from '../../lib/firebase/desiderata';
import { useBagPhase } from '../../context/BagPhaseContext';
import { getExchangeHistory, addShiftExchange, getShiftExchanges, removeShiftExchange } from '../../lib/firebase/shifts';
import CommentModal from '../../components/CommentModal';
import Portal from '../../components/Portal';
import { useAuth } from '../../hooks/useAuth';
import Toast from '../Toast';

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
}

const GeneratedPlanningTable: React.FC<GeneratedPlanningTableProps> = ({
  startDate,
  endDate,
  assignments,
  userId,
  showDesiderata = false,
  receivedShifts = {},
  isAdminView = false
}) => {
  const months = getMonthsInRange(startDate, endDate);
  const { user } = useAuth();
  const { config: bagPhaseConfig } = useBagPhase();
  const [selectedCell, setSelectedCell] = useState<{
    key: string;
    position: { x: number; y: number };
    assignment: ShiftAssignment;
  } | null>(null);
  const [desiderata, setDesiderata] = useState<Selections>({});
  const [exchanges, setExchanges] = useState<Record<string, ShiftExchange>>({});
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

  const handleCellClick = (event: React.MouseEvent, cellKey: string, assignment: ShiftAssignment) => {
    if (!assignment) return;
    
    // En Phase 2 (distribution) - désactiver les interactions pour les utilisateurs
    if (bagPhaseConfig.phase === 'distribution' && !isAdminView) {
      setToast({
        visible: true,
        message: 'La répartition des gardes est en cours. Veuillez patienter.',
        type: 'info'
      });
      return;
    }
    
    // En Phase 3 (completed) - désactiver les interactions pour les utilisateurs
    if (bagPhaseConfig.phase === 'completed' && !isAdminView) {
      setToast({
        visible: true,
        message: 'La période d\'échange est terminée.',
        type: 'info'
      });
      return;
    }
    
    // En Phase 1 (submission) ou en mode admin, permettre l'ouverture du modal
    // Extraire la date et la période du cellKey
    const [year, month, day, period] = cellKey.split('-');
    const formattedDate = `${year}-${month}-${day}`;
    
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
          period,
          shiftType,
          timeSlot,
          comment,
          createdAt: new Date().toISOString(),
          status: 'pending',
          interestedUsers: []
        } as ShiftExchange
      }));

      await addShiftExchange({
        userId: user.id || '',
        date,
        period,
        shiftType,
        timeSlot,
        comment: comment || ''
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
              <th colSpan={4} className="px-3 py-2 text-sm font-medium text-gray-700 border-b bg-gray-50">
                {format(month, 'MMMM yyyy', { locale: fr })}
              </th>
            </tr>
            <tr className="bg-gray-50">
              <th className="border px-2 py-1 text-sm font-medium text-gray-700 w-16">Jour</th>
              <th className="border px-2 py-1 text-sm font-medium text-gray-700 w-12">M</th>
              <th className="border px-2 py-1 text-sm font-medium text-gray-700 w-12">AM</th>
              <th className="border px-2 py-1 text-sm font-medium text-gray-700 w-12">S</th>
            </tr>
          </thead>
          <tbody>
            {filteredDays.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const grayedOut = isGrayedOut(day);
              return (
                <tr key={dateStr}>
                  <td className={`border px-2 py-1 text-sm ${grayedOut ? 'text-gray-500 bg-gray-100' : ''}`}>
                    <div className="flex items-center justify-between">
                      <span>{format(day, 'd', { locale: fr })}</span>
                      <span className="text-gray-500">
                        {format(day, 'EEEEEE', { locale: fr })}
                      </span>
                    </div>
                  </td>
                  {['M', 'AM', 'S'].map(period => {
                    const cellKey = `${dateStr}-${period}`;
                    const exchange = exchanges[cellKey];
                    
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
                    const isUnavailable = exchange && exchange.status === 'unavailable' && bagPhaseConfig.phase === 'completed';
                    
                    // Styles spécifiques aux gardes reçues
                    const interestedCount = exchange?.interestedUsers?.length || 0;
                    
                    // Construire les classes de fond
                    const bgClasses = [
                      showDesiderata && desideratum?.type ? 
                        desideratum.type === 'primary' ? 
                          grayedOut ? 'bg-red-200' : 'bg-red-100'
                          : grayedOut ? 'bg-blue-200' : 'bg-blue-100'
                        : '',
                      !desideratum?.type && grayedOut ? 'bg-gray-100' : '',
                      !desideratum?.type && isReceivedShift ? 
                        isReceivedPermutation ? 'bg-emerald-100' : 'bg-green-100' 
                        : '',
                      hasProposedGuard && !isUnavailable && !isReceivedShift ? 'bg-yellow-100' : '',
                      cellAssignment ? 'hover:bg-opacity-75' : ''
                    ].filter(Boolean).join(' ');

                    return (
                      <td
                        key={cellKey}
                        className={`border px-1 py-1 text-xs text-center relative transition-colors ${bgClasses} ${
                          cellAssignment && bagPhaseConfig.phase === 'submission' ? 'cursor-pointer hover:bg-gray-50' : ''
                        } ${isUnavailable && !isReceivedShift ? 'text-gray-400 line-through' : ''} ${
                          showDesiderata && desideratum?.type ? 'z-10' : ''
                        }`}
                        title={cellAssignment ? `${cellAssignment.shiftType} - ${cellAssignment.timeSlot}${isReceivedShift ? isReceivedPermutation ? ' (Garde permutée)' : ' (Garde reçue via la bourse)' : ''}${isUnavailable && !isReceivedShift ? ' (Garde n\'est plus disponible)' : ''}` : ''}
                        onClick={(e) => !isAdminView && cellAssignment && handleCellClick(e, cellKey, cellAssignment)}
                      >
                        <div className="relative">
                          <span className="text-gray-900">
                            {cellAssignment?.shiftType || ''}
                          </span>
                          {hasProposedGuard && interestedCount > 0 && !isUnavailable && !isReceivedShift && (
                            <div className="absolute -top-2 -right-2 bg-indigo-100 text-indigo-800 text-xs font-medium px-1.5 rounded-full border border-indigo-200">
                              {interestedCount}
                            </div>
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

  return (
    <>
      <div className="overflow-x-auto whitespace-nowrap">
        {months.map(renderMonthTable)}
      </div>

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