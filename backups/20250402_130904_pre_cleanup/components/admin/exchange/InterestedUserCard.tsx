import React, { useState } from 'react';
import { AlertTriangle, UserCheck, X, ArrowLeftRight } from 'lucide-react';
import type { ShiftExchange, BagPhaseConfig, ShiftAssignment } from '../../../types/planning';
import type { User } from '../../../types/users';
import ConfirmationModal from '../../ConfirmationModal';
import { useExchangeManagement } from '../../../hooks/useExchangeManagement';
import '../../../styles/BadgeStyles.css';

interface InterestedUserCardProps {
  userId: string;
  users: User[];
  exchange: ShiftExchange;
  conflictStates: Record<string, Record<string, boolean>>;
  userAssignments: Record<string, Record<string, ShiftAssignment>>;
  bagPhaseConfig: BagPhaseConfig;
  onValidateExchange: (exchangeId: string, interestedUserId: string, hasConflict: boolean) => void;
  onRemoveUser: (exchangeId: string, userId: string) => void;
}

const InterestedUserCard: React.FC<InterestedUserCardProps> = ({
  userId,
  users,
  exchange,
  conflictStates,
  userAssignments,
  bagPhaseConfig,
  onValidateExchange,
  onRemoveUser
}) => {
  const [showValidateConfirmation, setShowValidateConfirmation] = useState(false);
  const { exchanges, history } = useExchangeManagement(null);

  const interestedUser = users.find(u => u.id === userId);
  if (!interestedUser) return null;

  // Vérifier si la garde est déjà proposée à la bourse
  const hasConflict = conflictStates?.[exchange.id]?.[userId] ?? false;
  
  // Désactiver les logs pour éviter d'encombrer la console
  /*
  if (hasConflict) {
    console.log(`[${exchange.date}-${exchange.period}] ⚠️ Conflit pour ${interestedUser.lastName}:`, {
      exchangeId: exchange.id,
      userId,
      hasConflict
    });
  }
  */
  
  // Vérifier si c'est une permutation - l'utilisateur intéressé a déjà une garde sur ce créneau
  const assignmentKey = `${exchange.date}-${exchange.period}`;
  const userAssignment = userAssignments?.[userId]?.[assignmentKey];
  const hasValidAssignment = userAssignment && 
                           typeof userAssignment === 'object' && 
                           userAssignment.shiftType && 
                           typeof userAssignment.shiftType === 'string';
  
  // Une permutation est valide uniquement si l'utilisateur a réellement une garde valide sur ce créneau
  const isPermutation = hasConflict && hasValidAssignment;
  
  // Logs pour comprendre le problème d'affichage du conflit
  if (hasConflict) {
    console.log(`🔍 Analyse permutation pour ${interestedUser.lastName} (${exchange.date}-${exchange.period}):`, {
      hasConflict,
      userAssignment,
      hasValidAssignment,
      isPermutation,
      shiftType: userAssignment?.shiftType || 'No shiftType'
    });
  }
  
  // Vérifier si la garde est déjà en cours d'échange
  // Ajouter des logs pour déboguer
  const userHasAssignments = !!userAssignments?.[exchange.userId];
  const assignmentExists = userHasAssignments && userAssignments[exchange.userId][assignmentKey] !== undefined;
  
  // Garde signalée comme non disponible si l'utilisateur a des assignations mais pas celle-ci
  const isAlreadyInExchange = userHasAssignments && !assignmentExists;
  
  // Log pour déboguer
  if (exchange.date === "2025-06-08" && exchange.period === "AM") {
    console.log(`Garde ${exchange.date}-${exchange.period} (${exchange.userId}):`, {
      status: exchange.status,
      userHasAssignments,
      assignmentExists,
      isAlreadyInExchange,
      assignments: userAssignments?.[exchange.userId] || "No assignments found"
    });
  }

  // Calculer le pourcentage de gardes reçues par rapport à celles où l'utilisateur s'est positionné
  const calculateSuccessRate = () => {
    if (!history || !exchanges) return null;
    
    const positionedCount = exchanges.filter(e => e.interestedUsers?.includes(userId)).length;
    const receivedCount = history.filter(h => h.newUserId === userId).length;
    
    if (positionedCount === 0) return null;
    
    return Math.round((receivedCount / positionedCount) * 100);
  };
  
  const successRate = calculateSuccessRate();

  const handleValidateClick = () => {
    if (isAlreadyInExchange) {
      setShowValidateConfirmation(true);
      return;
    }

    if (isPermutation) {
      setShowValidateConfirmation(true);
    } else {
      onValidateExchange(exchange.id, userId, hasConflict);
    }
  };

  return (
    <>
    <div className={`flex items-center justify-between p-1.5 border rounded-lg ${
      exchange.status === 'unavailable'
        ? 'border-red-300 bg-red-50'
        : hasConflict 
        ? 'border-red-200 bg-red-50'
        : isAlreadyInExchange
        ? 'border-orange-200 bg-orange-50'
        : 'border-green-200 bg-green-50'
    }`}>
      <div className="flex items-center">
        {hasConflict ? (
          <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
        ) : isAlreadyInExchange ? (
          <AlertTriangle className="h-4 w-4 text-orange-500 mr-2" />
        ) : (
          <UserCheck className="h-4 w-4 text-green-500 mr-2" />
        )}
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900 leading-tight">
            {interestedUser.lastName.toUpperCase()}
            {successRate !== null && (
              <span className="text-xs text-gray-500 ml-1">
                ({successRate}%)
              </span>
            )}
          </span>
          <span className="text-xs text-gray-500 leading-tight">
            {interestedUser.firstName}
          </span>
          {isAlreadyInExchange && (
            <span className="text-xs text-orange-700 mt-1">
              Cette garde n'est plus disponible dans le planning
            </span>
          )}
          {exchange.status === 'unavailable' && (
            <span className="text-xs text-red-700 mt-1">
              Cette garde a déjà été échangée
            </span>
          )}
          {hasConflict && (
            <span className={`mt-1 px-2 py-0.5 text-xs rounded-full border font-medium ${
              exchange.period === 'M'
                ? 'badge-morning'
                : exchange.period === 'AM'
                ? 'badge-afternoon'
                : 'badge-evening'
            }`}>
              {userAssignment?.shiftType || 'Garde inconnue'}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <button
            onClick={() => onRemoveUser(exchange.id, userId)}
            className={`p-1 border rounded-full transition-all ${
              bagPhaseConfig.phase !== 'distribution'
                ? 'text-gray-300 bg-gray-50 cursor-not-allowed'
                : 'text-gray-500 hover:text-red-600 bg-white hover:bg-red-50 border-gray-300 hover:border-red-300'
            }`}
            disabled={bagPhaseConfig.phase !== 'distribution'}
            title="Annuler cet intérêt"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            onClick={handleValidateClick}
            className={`p-1 rounded-full border transition-all ${
              bagPhaseConfig.phase !== 'distribution'
                ? 'text-gray-300 bg-gray-50 cursor-not-allowed'
                : hasConflict
                  ? 'text-red-600 hover:text-white bg-white hover:bg-red-600 border-red-300 hover:border-red-600'
                  : 'text-green-600 hover:text-white bg-white hover:bg-green-600 border-green-300 hover:border-green-600'
            }`}
            disabled={bagPhaseConfig.phase !== 'distribution'}
            title={hasConflict ? "Échanger malgré le conflit" : "Échanger la garde"}
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>

    {/* Modal de confirmation pour la permutation */}
    <ConfirmationModal
      isOpen={showValidateConfirmation}
      title={isAlreadyInExchange ? "Garde déjà échangée" : isPermutation ? "Confirmer la permutation" : "Confirmer l'échange"}
      message={isAlreadyInExchange 
        ? "Cette garde a déjà été échangée ou n'est plus disponible. Veuillez vérifier l'historique des échanges."
        : isPermutation
          ? "Êtes-vous sûr de vouloir valider cette permutation ? Les gardes seront échangées entre les deux médecins."
          : "Êtes-vous sûr de vouloir valider cet échange simple ?"}
      confirmLabel={isAlreadyInExchange ? "Fermer" : "Valider"}
      onConfirm={() => {
        if (isAlreadyInExchange) {
          setShowValidateConfirmation(false);
          return;
        }
        onValidateExchange(exchange.id, userId, hasConflict);
        setShowValidateConfirmation(false);
      }}
      onCancel={() => setShowValidateConfirmation(false)}
    />
    </>
  );
};

export default InterestedUserCard;
