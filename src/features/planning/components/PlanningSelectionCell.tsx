import React, { useState, useCallback } from 'react';
import { MessageSquare } from 'lucide-react';
import { CommentModal } from '../../../components/modals';
import { Portal } from '../../../components';
import type { PeriodSelection } from '../types';

interface PlanningSelectionCellProps {
  cellKey: string;
  selection: PeriodSelection;
  onMouseDown: (key: string, event: React.MouseEvent) => void;
  onMouseEnter: (key: string) => void;
  onComment: (key: string, comment: string) => void;
  onOpenModal: (key: string, position: { x: number; y: number }) => void;
  activeModal: { cellKey: string; position: { x: number; y: number } } | null;
  onCloseModal: () => void;
  isGrayedOut: boolean;
  readOnly?: boolean;
  isBlocked?: boolean;
}

/**
 * Cellule de planning pour afficher et interagir avec les sélections de périodes
 * Permet de sélectionner des périodes et d'ajouter des commentaires
 */
const PlanningSelectionCell: React.FC<PlanningSelectionCellProps> = ({
  cellKey,
  selection,
  onMouseDown,
  onMouseEnter,
  onComment,
  onOpenModal,
  activeModal,
  onCloseModal,
  isGrayedOut,
  readOnly = false,
  isBlocked = false
}) => {
  const isModalOpen = activeModal?.cellKey === cellKey;

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!readOnly && !isBlocked && selection?.type !== null) {
      onOpenModal(cellKey, { x: e.clientX, y: e.clientY });
    }
  }, [readOnly, isBlocked, selection.type, cellKey, onOpenModal]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!readOnly && !isBlocked && selection?.type !== null) {
      e.stopPropagation();
      const touch = e.touches[0];
      const timer = setTimeout(() => {
        onOpenModal(cellKey, { x: touch.clientX, y: touch.clientY });
      }, 500);

      const cleanup = () => {
        clearTimeout(timer);
        document.removeEventListener('touchend', cleanup);
        document.removeEventListener('touchmove', cleanup);
      };

      document.addEventListener('touchend', cleanup);
      document.addEventListener('touchmove', cleanup);
    }
  }, [readOnly, isBlocked, selection.type, cellKey, onOpenModal]);

  const handleMouseDown = (event: React.MouseEvent) => {
    // Ne déclencher que pour le clic gauche (button 0) et si pas en lecture seule ou bloqué
    if (readOnly || isBlocked) {
      return; // Ne rien faire si en lecture seule ou bloqué
    } else if (!isModalOpen && event.button === 0) {
      onMouseDown(cellKey, event);
    }
  };

  const handleMouseEnter = () => {
    if (!readOnly && !isModalOpen && !isBlocked) {
      onMouseEnter(cellKey);
    }
  };

  const getCellClasses = () => {
    // Classes de base qui s'appliquent à toutes les cellules
    const baseClasses = `${selection.comment ? 'border-2 border-black' : 'border'} px-2 text-center select-none transition-colors`;
    const cursorClasses = readOnly || isBlocked ? 'cursor-not-allowed' : 'cursor-pointer';
    const commentCursor = selection?.type !== null ? 'context-menu' : 'default';
    const hasComment = Boolean(selection.comment);
    const isWeekend = isGrayedOut;
    
    // Créer un tableau de classes pour pouvoir les ajouter de manière plus structurée
    const classes = [baseClasses, cursorClasses];
    
    // NOUVELLE APPROCHE: Appliquer les couleurs dans un ordre de priorité clair
    
    // 0. Si la date est bloquée, appliquer un style spécial
    if (isBlocked) {
      if (!selection?.type) {
        // Cellule bloquée sans sélection - même couleur que la bannière
        classes.push('relative bg-yellow-50 border-yellow-200');
      } else {
        // Cellule bloquée avec sélection - garder la couleur mais plus pâle
        classes.push('opacity-60');
      }
    }
    
    // 1. D'abord la couleur de base pour les week-ends (seulement si aucun type de sélection)
    if (isWeekend && !selection?.type && !isBlocked) {
      classes.push('bg-gray-100');
    }
    
    // 2. Ensuite les classes pour les types de sélection
    if (selection?.type === 'primary') {
      // Classe de texte toujours appliquée
      classes.push('text-red-800');
      
      // Si c'est un week-end, la couleur est plus foncée
      if (isWeekend) {
        classes.push('bg-red-200');
        classes.push('text-red-900'); // Texte plus foncé pour les week-ends
      } else if (!hasComment && !isBlocked) {
        // Si pas de commentaire, utiliser la couleur normale
        classes.push('bg-red-100');
      }
      
      classes.push(commentCursor);
    } else if (selection?.type === 'secondary') {
      // Classe de texte toujours appliquée
      classes.push('text-blue-800');
      
      // Si c'est un week-end, la couleur est plus foncée
      if (isWeekend) {
        classes.push('bg-blue-200');
        classes.push('text-blue-900'); // Texte plus foncé pour les week-ends
      } else if (!hasComment && !isBlocked) {
        // Si pas de commentaire, utiliser la couleur normale
        classes.push('bg-blue-100');
      }
      
      classes.push(commentCursor);
    }
    
    // 3. Appliquer la classe de commentaire en dernier (priorité la plus élevée)
    if (hasComment) {
      classes.push('bg-yellow-50');
    }
    
    // 4. Ajouter un hover uniquement si nécessaire
    if (!readOnly && !selection?.type && !isWeekend && !isBlocked) {
      classes.push('hover:bg-gray-50');
    }
    
    return classes.join(' ');
  };

  return (
    <>
      <td
        onMouseDown={handleMouseDown}
        onMouseEnter={handleMouseEnter}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        className={getCellClasses()}
        title={readOnly ? selection.comment : isBlocked ? 'Cette date est bloquée' : undefined}
      >
        <div className="relative flex items-center justify-center w-full py-1">
          {/* Contenu normal de la cellule */}
          {!isBlocked && (
            <span className="font-medium">
              {selection?.type === 'primary' && 'P'}
              {selection?.type === 'secondary' && 'S'}
            </span>
          )}
          
          {/* Icône de commentaire */}
          {selection.comment && !isBlocked && (
            <MessageSquare className="absolute -top-2 -right-1 h-3 w-3 text-yellow-600" />
          )}
          
          {/* Symbole de blocage - centrage parfait */}
          {isBlocked && !selection?.type && (
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 16 16" 
              className="text-yellow-600 block"
            >
              <circle 
                cx="8" 
                cy="8" 
                r="7" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1.5" 
              />
              <line 
                x1="3.5" 
                y1="8" 
                x2="12.5" 
                y2="8" 
                stroke="currentColor" 
                strokeWidth="2" 
                transform="rotate(-45 8 8)"
              />
            </svg>
          )}
          
          {/* Si bloqué avec sélection, afficher les deux */}
          {isBlocked && selection?.type && (
            <>
              <span className="font-medium opacity-50">
                {selection?.type === 'primary' && 'P'}
                {selection?.type === 'secondary' && 'S'}
              </span>
              <svg 
                width="18" 
                height="18" 
                viewBox="0 0 18 18" 
                className="text-yellow-600 opacity-70 absolute"
              >
                <circle 
                  cx="9" 
                  cy="9" 
                  r="7.5" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                />
                <line 
                  x1="3.5" 
                  y1="9" 
                  x2="14.5" 
                  y2="9" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  transform="rotate(-45 9 9)"
                />
              </svg>
            </>
          )}
          
          {/* Icône de commentaire pour les cellules bloquées avec sélection */}
          {selection.comment && isBlocked && selection?.type && (
            <MessageSquare className="absolute -top-2 -right-1 h-3 w-3 text-yellow-600 z-10" />
          )}
        </div>
      </td>

      {isModalOpen && (
        <Portal>
          <CommentModal
            isOpen={true}
            onClose={onCloseModal}
            onSave={(comment) => onComment(cellKey, comment)}
            initialComment={selection.comment}
            position={activeModal.position}
            cellKey={cellKey}
            readOnly={readOnly}
          />
        </Portal>
      )}
    </>
  );
};

export default PlanningSelectionCell;
