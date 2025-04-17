import React, { useMemo } from 'react';
import { Badge } from './common';
import type { ShiftAssignment } from '../types/planning';
import type { ShiftExchange } from '../types/exchange';

interface PlanningGridCellProps {
  cellKey: string;
  assignment?: ShiftAssignment;
  exchange?: ShiftExchange;
  directExchange?: ShiftExchange;
  replacement?: any;
  desideratum?: { type: 'primary' | 'secondary' | null };
  receivedShift?: {
    originalUserId: string;
    newUserId: string;
    isPermutation: boolean;
    shiftType: string;
    timeSlot: string;
  };
  userId?: string;
  isGrayedOut: boolean;
  period: 'M' | 'AM' | 'S';
  bagPhaseConfig: { phase: 'submission' | 'distribution' | 'completed' };
  isAdminView?: boolean;
  onCellClick: (event: React.MouseEvent, cellKey: string, assignment: ShiftAssignment) => void;
}

/**
 * Composant optimisé pour les cellules du planning
 * Utilise React.memo pour éviter les re-rendus inutiles
 */
const PlanningGridCell: React.FC<PlanningGridCellProps> = React.memo(({
  cellKey,
  assignment,
  exchange,
  directExchange,
  replacement,
  desideratum,
  receivedShift,
  userId,
  isGrayedOut,
  period,
  bagPhaseConfig,
  isAdminView = false,
  onCellClick
}) => {
  // Vérifier si c'est une garde reçue via un échange
  const isReceivedShift = receivedShift && (
    receivedShift.newUserId === userId || 
    (receivedShift.isPermutation && receivedShift.originalUserId === userId)
  );
  
  // Pour afficher différemment les permutations
  const isReceivedPermutation = isReceivedShift && receivedShift.isPermutation;
  
  // Vérifier si l'utilisateur a proposé cette garde à l'échange
  const hasProposedGuard = exchange && exchange.userId === userId && !isReceivedShift;
  
  // Vérifier si la garde est proposée aux remplaçants
  const isProposedToReplacements = replacement && replacement.originalUserId === userId;
  
  // Obtenir les types d'opération à partir de l'échange
  const operationTypes = useMemo(() => {
    if (!exchange) return [];
    
    // Prioriser le tableau operationTypes s'il existe
    if (exchange.operationTypes?.length) {
      return exchange.operationTypes;
    }
    
    // Sinon, déterminer les types à partir de operationType
    if (exchange.operationType === 'both') {
      return ['exchange', 'give'];
    }
    
    return exchange.operationType ? [exchange.operationType] : [];
  }, [exchange]);
  
  // Déterminer les combinaisons de types d'opérations
  const hasExchangeOp = operationTypes.includes('exchange');
  const hasGiveOp = operationTypes.includes('give');
  const hasBoth = hasExchangeOp && hasGiveOp;
  
  // Nombre d'utilisateurs intéressés
  const interestedCount = exchange?.interestedUsers?.length || 0;
  
  // Déterminer les couleurs de fond pour les échanges directs en phase completed
  const directExchangeBgClass = useMemo(() => {
    if (bagPhaseConfig.phase !== 'completed') return '';
    
    if (directExchange && directExchange.userId === userId) {
      const directExchangeOpTypes = directExchange.operationTypes || [];
      const hasDirectExchangeOp = directExchangeOpTypes.includes('exchange');
      const hasDirectGiveOp = directExchangeOpTypes.includes('give');
      const hasDirectReplacementOp = directExchangeOpTypes.includes('replacement');
      
      if (hasDirectExchangeOp && hasDirectGiveOp && hasDirectReplacementOp) {
        return 'bg-amber-50'; // CER
      } else if (hasDirectExchangeOp && hasDirectGiveOp) {
        return 'bg-orange-50'; // CE
      } else if (hasDirectExchangeOp && hasDirectReplacementOp) {
        return 'bg-lime-50'; // ER
      } else if (hasDirectGiveOp && hasDirectReplacementOp) {
        return 'bg-amber-50'; // CR
      } else if (hasDirectExchangeOp) {
        return 'bg-green-50'; // E
      } else if (hasDirectGiveOp) {
        return 'bg-yellow-50'; // C
      } else if (hasDirectReplacementOp) {
        return 'bg-amber-50'; // R
      }
    } else if (isProposedToReplacements) {
      return 'bg-amber-50'; // R
    }
    
    return '';
  }, [bagPhaseConfig.phase, directExchange, userId, isProposedToReplacements]);
  
  // Vérifier si la date est dans le passé
  const isPastDate = useMemo(() => {
    if (!assignment?.date) return false;
    const cellDate = new Date(assignment.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return cellDate < today;
  }, [assignment?.date]);

  // Construire les classes de fond
  const bgClasses = useMemo(() => {
    // Forcer la mise à jour lorsque desideratum change
    console.log("PlanningGridCell: Recalcul des classes de fond pour", cellKey, "desideratum:", desideratum?.type);
    
    // Déterminer les classes en fonction des différentes conditions
    const classes = [];
    
    // NOUVELLE APPROCHE: Appliquer les couleurs de base d'abord
    
    // Classe de base pour les cellules grisées (week-ends)
    if (isGrayedOut) {
      classes.push('bg-gray-100');
    }
    
    // Appliquer les couleurs de désidérata (qu'il y ait une garde ou non)
    if (desideratum?.type) {
      if (desideratum.type === 'primary') {
        // Pour les désidératas principaux (rouge), plus foncé si grisé
        classes.push(isGrayedOut ? 'bg-red-200' : 'bg-red-100');
      } else {
        // Pour les désidératas secondaires (bleu), plus foncé si grisé
        classes.push(isGrayedOut ? 'bg-blue-200' : 'bg-blue-100');
      }
    }
    
    // ENSUITE, appliquer les classes pour les gardes et échanges
    // en utilisant la transparence pour préserver les couleurs de base
    
    // Gardes proposées
    if (bagPhaseConfig.phase !== 'completed' && hasProposedGuard && !isReceivedShift) {
      if (hasBoth) {
        classes.push('bg-purple-100/80'); // Utiliser la transparence
      } else if (hasExchangeOp) {
        classes.push('bg-yellow-100/80');
      } else if (hasGiveOp) {
        classes.push('bg-blue-100/80');
      }
      classes.push('shadow-sm'); // Appliquer l'ombre indépendamment
    }
    
    // Échanges directs en phase completed
    else if (directExchangeBgClass) {
      // Utiliser la transparence pour préserver les couleurs de base
      const transparentClass = directExchangeBgClass.replace('bg-', 'bg-') + '/70';
      classes.push(transparentClass);
    }
    
    // Gardes reçues 
    else if (isReceivedShift && bagPhaseConfig.phase !== 'completed') {
      if (isReceivedPermutation) {
        classes.push('bg-emerald-100/70');
      } else {
        classes.push('bg-green-100/70');
      }
    }
    
    // Ajouter les classes communes
    if (assignment) {
      if (!isPastDate) {
        classes.push('hover:bg-opacity-75');
      }
    }
    
    // Ajouter une classe pour les dates passées
    if (isPastDate) {
      // Suppression de bg-gray-50/50 qui causait le fond blanc
      // Appliquer uniquement l'opacité pour préserver le fond d'origine
      classes.push('opacity-70');
      // Supprimer le pointeur de souris
      classes.push('cursor-default');
    }
    
    // Ajouter une classe de transition pour les animations
    classes.push('cell-transition');
    
    return classes.filter(Boolean).join(' ');
  }, [
    directExchangeBgClass, 
    desideratum, 
    isGrayedOut, 
    isReceivedShift, 
    isReceivedPermutation, 
    bagPhaseConfig.phase, 
    hasProposedGuard, 
    hasBoth, 
    hasExchangeOp, 
    hasGiveOp, 
    assignment,
    isPastDate
  ]);
  
  // Générer le titre (tooltip) de la cellule
  const cellTitle = useMemo(() => {
    if (!assignment) return '';
    
    let title = `${assignment.shiftType} - ${assignment.timeSlot}`;
    
    // Indiquer si la garde est dans le passé
    if (isPastDate) {
      title += ' (Historique - non modifiable)';
    } else {
      // Info sur les gardes reçues
      if (isReceivedShift) {
        title += isReceivedPermutation ? ' (Garde permutée)' : ' (Garde reçue via la bourse)';
      }
      
      // Info sur tous les types d'opérations dans un seul message
      if (hasProposedGuard || isProposedToReplacements) {
        const proposedFor = [
          hasExchangeOp ? 'Échange' : '',
          hasGiveOp ? 'Cession' : '',
          isProposedToReplacements ? 'Remplaçant' : '',
        ].filter(Boolean).join(', ');
        
        if (proposedFor) {
          title += ` (Proposée pour: ${proposedFor})`;
        }
      }
    }
    
    return title;
  }, [
    assignment, 
    isPastDate,
    isReceivedShift, 
    isReceivedPermutation, 
    hasProposedGuard, 
    isProposedToReplacements, 
    hasExchangeOp, 
    hasGiveOp
  ]);
  
  // Si pas d'assignment, rendre une cellule vide mais avec le grisage et les desiderata appropriés
  if (!assignment) {
    // Déterminer la classe de fond en fonction du desideratum
    let bgClass = isGrayedOut ? 'bg-gray-100' : '';
    
    // Si un desideratum existe
    if (desideratum?.type) {
      if (desideratum.type === 'primary') {
        bgClass = isGrayedOut ? 'bg-red-200' : 'bg-red-100';
      } else if (desideratum.type === 'secondary') {
        bgClass = isGrayedOut ? 'bg-blue-200' : 'bg-blue-100';
      }
    }
    
    return <td className={`border px-1 py-1 text-xs text-center ${bgClass}`} data-empty="true" data-grayed-out={isGrayedOut ? 'true' : 'false'}></td>;
  }
  
  return (
    <td
      className={`border px-1 py-1 text-xs text-center relative transition-colors ${bgClasses} ${
        assignment && bagPhaseConfig.phase === 'submission' && !isPastDate ? 'cursor-pointer hover:bg-gray-50' : ''
      } ${
        desideratum?.type ? 'z-10' : ''
      }`}
      title={cellTitle}
      onClick={(e) => !isAdminView && assignment && !isPastDate && onCellClick(e, cellKey, assignment)}
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
          {assignment.shiftType || ''}
        </span>
        
        {/* Badges pour les différents types d'opérations */}
        <div className="absolute -top-2 -right-2 flex space-x-1">
          {/* Badge pour les intéressés */}
          {bagPhaseConfig.phase !== 'completed' && hasProposedGuard && interestedCount > 0 && !isReceivedShift && (
            <span className="badge-appear">
              <Badge type="interested" count={interestedCount} size="sm" />
            </span>
          )}
          
          {/* Badge pour les types d'opérations */}
          {(() => {
            // En phase completed, on veut afficher tous les types d'opérations des échanges directs
            if (bagPhaseConfig.phase === 'completed') {
              // Si un échange direct existe pour cette cellule et cet utilisateur
              if (directExchange && directExchange.userId === userId) {
                return (
                  <span className="badge-appear absolute top-0 right-0 mt-1 mr-1" style={{ zIndex: 40 }}>
                    <Badge 
                      type="operation-types" 
                      size="sm" 
                      operationTypes={directExchange.operationTypes || []}
                    />
                  </span>
                );
              }
              
              // Sinon, afficher uniquement le badge de remplacement si applicable
              if (isProposedToReplacements) {
                return (
                  <span className="badge-appear absolute top-0 right-0 mt-1 mr-1" style={{ zIndex: 40 }}>
                    <Badge 
                      type="operation-types" 
                      size="sm" 
                      operationTypes={['replacement']}
                    />
                  </span>
                );
              }
              
              return null;
            }
            
            // Pour les autres phases, conserver le comportement existant mais sans pastille E pour la bourse aux gardes
            if ((hasProposedGuard || isProposedToReplacements) && operationTypes.length + (isProposedToReplacements ? 1 : 0) > 0) {
              // Si c'est un échange de la bourse aux gardes (type 'bag'), ne pas afficher la pastille E
              const filteredOperationTypes = hasProposedGuard && exchange?.exchangeType === 'bag' 
                ? operationTypes.filter(type => type !== 'exchange')
                : [...(hasProposedGuard ? operationTypes : [])];
              
              // Ajouter le type 'replacement' si nécessaire
              if (isProposedToReplacements) {
                filteredOperationTypes.push('replacement');
              }
              
              // N'afficher le badge que s'il reste des types d'opérations après filtrage
              if (filteredOperationTypes.length > 0) {
                return (
                  <span className="badge-appear absolute top-0 right-0 -mt-1 -mr-1" style={{ zIndex: 40 }}>
                    <Badge 
                      type="operation-types" 
                      size="sm" 
                      operationTypes={filteredOperationTypes}
                    />
                  </span>
                );
              }
            }
            
            return null;
          })()}
        </div>
      </div>
    </td>
  );
});

export default PlanningGridCell;
