import React, { useMemo } from 'react';
import { Badge } from './common';
import type { ShiftAssignment } from '../types/planning';
import type { ShiftExchange } from '../types/exchange';
import { getCellBackgroundClass } from '../utils/cellColorUtils';
import { createParisDate, toParisTime } from '../utils/timezoneUtils';

// Importer les styles pour les couleurs des opérations
import '../styles/OperationColors.css';

interface PlanningGridCellProps {
  cellKey: string;
  assignment?: ShiftAssignment;
  exchange?: ShiftExchange;
  directExchange?: ShiftExchange;
  replacement?: {
    replacementUserId: string;
    originalUserId: string;
    status: 'pending' | 'accepted' | 'rejected';
  };
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
  
  // Vérifier si cette garde a reçu des propositions (pour afficher une pastille)
  const hasIncomingProposals = (exchange && exchange.hasProposals) || 
                              (directExchange && directExchange.hasProposals) || false;
  
  // Vérifier si la garde est proposée aux remplaçants
  const isProposedToReplacements = replacement && replacement.originalUserId === userId;
  
  // Obtenir les types d'opération à partir de l'échange
  const operationTypes = useMemo(() => {
    if (!exchange) return [];
    
    // Forcer un log pour vérifier la structure de l'échange
    console.log('PlanningGridCell - Échange détecté:', exchange.id, 
      'operationTypes:', exchange.operationTypes, 
      'operationType:', exchange.operationType,
      'userId:', exchange.userId,
      'cellKey:', cellKey);
    
    // Prioriser le tableau operationTypes s'il existe
    if (exchange.operationTypes?.length) {
      return exchange.operationTypes;
    }
    
    // Sinon, déterminer les types à partir de operationType
    if (exchange.operationType === 'both') {
      return ['exchange', 'give'];
    }
    
    return exchange.operationType ? [exchange.operationType] : [];
  }, [exchange, cellKey]);
  
  // Déterminer les combinaisons de types d'opérations
  const hasExchangeOp = operationTypes.includes('exchange');
  const hasGiveOp = operationTypes.includes('give');
  const hasBoth = hasExchangeOp && hasGiveOp;
  
  // Nombre d'utilisateurs intéressés
  const interestedCount = exchange?.interestedUsers?.length || 0;
  
  // Déterminer les couleurs de fond pour les échanges directs en phase completed
  const directExchangeBgClass = useMemo(() => {
    if (bagPhaseConfig.phase !== 'completed') return '';
    
    if (directExchange) {
      console.log('PlanningGridCell - Échange direct en PHASE COMPLETED détecté:', directExchange.id, 
        'operationTypes:', directExchange.operationTypes, 
        'operationType:', directExchange.operationType,
        'userId:', directExchange.userId, 'userIdMatch:', directExchange.userId === userId,
        'cellKey:', cellKey);
    }
    
    if (directExchange && directExchange.userId === userId) {
      const directExchangeOpTypes = directExchange.operationTypes || [];
      const hasDirectExchangeOp = directExchangeOpTypes.includes('exchange');
      const hasDirectGiveOp = directExchangeOpTypes.includes('give');
      const hasDirectReplacementOp = directExchangeOpTypes.includes('replacement');
      
      console.log('PlanningGridCell - Analyse types PHASE COMPLETED:', 
        'hasExchange:', hasDirectExchangeOp, 
        'hasGive:', hasDirectGiveOp, 
        'hasReplacement:', hasDirectReplacementOp);
      
      // Utiliser des couleurs plus foncées pour être sûr qu'elles s'affichent
      if (hasDirectExchangeOp && hasDirectGiveOp && hasDirectReplacementOp) {
        return 'bg-amber-200'; // CER
      } else if (hasDirectExchangeOp && hasDirectGiveOp) {
        return 'bg-orange-200'; // CE
      } else if (hasDirectExchangeOp && hasDirectReplacementOp) {
        return 'bg-lime-200'; // ER
      } else if (hasDirectGiveOp && hasDirectReplacementOp) {
        return 'bg-amber-200'; // CR
      } else if (hasDirectExchangeOp) {
        return 'bg-green-200'; // E
      } else if (hasDirectGiveOp) {
        return 'bg-yellow-200'; // C
      } else if (hasDirectReplacementOp) {
        return 'bg-amber-200'; // R
      }
      
      // Fallback - s'il y a un échange direct mais aucun type, appliquer quand même une couleur
      console.log('⚠️ DIRECT EXCHANGE WITHOUT TYPE IN COMPLETED PHASE:', cellKey);
      return 'bg-blue-200';
    } else if (isProposedToReplacements) {
      return 'bg-amber-200'; // R
    }
    
    return '';
  }, [bagPhaseConfig.phase, directExchange, userId, isProposedToReplacements, cellKey]);
  
  // Vérifier si la date est dans le passé
  const isPastDate = useMemo(() => {
    if (!assignment?.date) return false;
    const cellDate = toParisTime(assignment.date);
    const today = createParisDate();
    today.setHours(0, 0, 0, 0);
    return cellDate < today;
  }, [assignment?.date]);

  // Utiliser l'utilitaire de coloration centralisé

  // Construire les classes de fond
  const bgClasses = useMemo(() => {
    // Utiliser l'utilitaire centralisé pour déterminer la classe de fond
    const baseClass = getCellBackgroundClass({
      isGrayedOut,
      desideratum,
      showDesiderata: !!desideratum,
      exchange,
      directExchange,
      isProposedToReplacements,
      isReceivedShift,
      isReceivedPermutation,
      userId,
      bagPhase: bagPhaseConfig.phase
    });
    
    // Collecter toutes les classes supplémentaires
    const classes = [];
    
    // Ajouter la classe de fond principale
    if (baseClass) {
      classes.push(baseClass);
    }
    
    // Ajouter une classe spécifique pour les gardes avec propositions
    if (hasIncomingProposals) {
      classes.push('ring-1 ring-red-400');
    }
    
    // Ajouter les classes communes
    if (assignment && !isPastDate) {
      classes.push('hover:bg-opacity-75');
    }
    
    // Ajouter une classe pour les dates passées
    if (isPastDate) {
      classes.push('opacity-70');
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
    hasIncomingProposals,
    hasBoth, 
    hasExchangeOp, 
    hasGiveOp, 
    assignment,
    isPastDate,
    userId,
    exchange,
    directExchange,
    isProposedToReplacements
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
      
      // Info sur les propositions reçues
      if (hasIncomingProposals) {
        title += ' (Vous avez reçu des propositions pour cette garde)';
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
    hasGiveOp,
    hasIncomingProposals
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
      <div className="relative w-full h-full">
        {/* Texte du shift, avec position relative pour ne pas être recouvert */}
        <span className={`
          inline-block relative z-10 font-semibold text-[13px] 
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
        
        {/* Badges pour les différents types d'opérations - position absolue dans le coin supérieur droit */}
        <div className="absolute top-0 right-0 badge-container" style={{ fontSize: 0, maxWidth: '40%', maxHeight: '40%', pointerEvents: 'auto', margin: '-4px 0 0 0' }}>
          {/* Badge pour les intéressés */}
          {bagPhaseConfig.phase !== 'completed' && hasProposedGuard && interestedCount > 0 && !isReceivedShift && (
            <div className="badge-appear" style={{ position: 'absolute', top: '-4px', right: '0' }}>
              <Badge type="interested" count={interestedCount} size="xs" />
            </div>
          )}
          
          {/* Badge pour les propositions reçues */}
          {hasIncomingProposals && (
            <div 
              className="absolute -bottom-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white shadow-sm animate-pulse" 
              title="Vous avez reçu des propositions pour cette garde"
            ></div>
          )}
          
          {/* Badge pour les types d'opérations */}
          {(() => {
            // En phase completed, on veut afficher tous les types d'opérations des échanges directs
            if (bagPhaseConfig.phase === 'completed') {
              // Si un échange direct existe pour cette cellule et cet utilisateur
              if (directExchange && directExchange.userId === userId) {
                return (
                  <div className="badge-appear" style={{ position: 'absolute', zIndex: 40, top: '-4px', right: '0' }}>
                    <Badge 
                      type="operation-types" 
                      size="xs" 
                      operationTypes={directExchange.operationTypes || []}
                    />
                  </div>
                );
              }
              
              // Sinon, afficher uniquement le badge de remplacement si applicable
              if (isProposedToReplacements) {
                return (
                  <div className="badge-appear" style={{ position: 'absolute', zIndex: 40, top: '-4px', right: '0' }}>
                    <Badge 
                      type="operation-types" 
                      size="xs" 
                      operationTypes={['replacement']}
                    />
                  </div>
                );
              }
              
              return null;
            }
            
            // Pour les autres phases, conserver le comportement existant
            console.log('PlanningGridCell - Évaluation du badge:', 
              'hasProposedGuard:', hasProposedGuard, 
              'isProposedToReplacements:', isProposedToReplacements,
              'operationTypes:', operationTypes,
              'exchange:', exchange?.id,
              'exchangeType:', exchange?.exchangeType,
              'directExchange:', directExchange?.id);
            
            // Badge seulement pour les échanges directs, pas pour la bourse aux gardes
            // Utiliser directExchange comme source alternative d'échanges directs
            if ((hasProposedGuard && exchange?.exchangeType !== 'bag') || directExchange || isProposedToReplacements) {
              // Construire la liste des types d'opérations à afficher
              const filteredOperationTypes: string[] = [];
              
              // Ajouter les types d'échange si c'est une garde proposée en direct exchange
              if (hasProposedGuard && exchange?.exchangeType !== 'bag') {
                operationTypes.forEach(type => filteredOperationTypes.push(type));
              }
              
              // Ajouter les types d'un échange direct explicite si présent
              if (directExchange) {
                const directTypes = directExchange.operationTypes || [];
                directTypes.forEach(type => {
                  if (!filteredOperationTypes.includes(type)) {
                    filteredOperationTypes.push(type);
                  }
                });
                
                // Utiliser l'operationType si operationTypes n'est pas disponible
                if (directTypes.length === 0 && directExchange.operationType) {
                  if (directExchange.operationType === 'both') {
                    if (!filteredOperationTypes.includes('exchange')) filteredOperationTypes.push('exchange');
                    if (!filteredOperationTypes.includes('give')) filteredOperationTypes.push('give');
                  } else if (!filteredOperationTypes.includes(directExchange.operationType)) {
                    filteredOperationTypes.push(directExchange.operationType);
                  }
                }
              }
              
              // Ajouter le type 'replacement' si applicable
              if (isProposedToReplacements) {
                if (!filteredOperationTypes.includes('replacement')) {
                  filteredOperationTypes.push('replacement');
                }
              }
              
              // Log des opérations filtrées
              console.log('PlanningGridCell - Types filtrés:', filteredOperationTypes);
              
              // Afficher le badge seulement s'il y a des types d'opérations
              if (filteredOperationTypes.length > 0) {
                return (
                  <div className="badge-appear" style={{ position: 'absolute', zIndex: 40, top: '-4px', right: '0' }}>
                    <Badge 
                      type="operation-types" 
                      size="xs" 
                      operationTypes={filteredOperationTypes}
                    />
                  </div>
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
