import React, { useState, useCallback } from 'react';
import { MessageSquare } from 'lucide-react';
import CommentModal from './CommentModal';
import Portal from './Portal';
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
  readOnly = false
}) => {
  const isModalOpen = activeModal?.cellKey === cellKey;

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!readOnly && selection?.type !== null) {
      onOpenModal(cellKey, { x: e.clientX, y: e.clientY });
    }
  }, [readOnly, selection.type, cellKey, onOpenModal]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!readOnly && selection?.type !== null) {
      e.stopPropagation();
      const touch = e.touches[0];
      let timer = setTimeout(() => {
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
  }, [readOnly, selection.type, cellKey, onOpenModal]);

  const handleMouseDown = (event: React.MouseEvent) => {
    // Ne déclencher que pour le clic gauche (button 0) et si pas en lecture seule
    if (readOnly) {
      onMouseDown(cellKey, event);
    } else if (!isModalOpen && event.button === 0) {
      onMouseDown(cellKey, event);
    }
  };

  const handleMouseEnter = () => {
    if (!readOnly && !isModalOpen) {
      onMouseEnter(cellKey);
    }
  };

  const getCellClasses = () => {
    // Classes de base qui s'appliquent à toutes les cellules
    const baseClasses = `${selection.comment ? 'border-2 border-black' : 'border'} px-2 py-1 text-center select-none transition-colors`;
    const cursorClasses = readOnly ? 'cursor-default' : 'cursor-pointer';
    const commentCursor = selection?.type !== null ? 'context-menu' : 'default';
    const hasComment = Boolean(selection.comment);
    const isWeekend = isGrayedOut;
    
    // Créer un tableau de classes pour pouvoir les ajouter de manière plus structurée
    const classes = [baseClasses, cursorClasses];
    
    // NOUVELLE APPROCHE: Appliquer les couleurs dans un ordre de priorité clair
    
    // 1. D'abord la couleur de base pour les week-ends
    if (isWeekend) {
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
      } else if (!hasComment) {
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
      } else if (!hasComment) {
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
    if (!readOnly && !selection?.type && !isWeekend) {
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
        title={readOnly ? selection.comment : undefined}
      >
        <span className="relative inline-block w-full">
          <span className="font-medium">
            {selection?.type === 'primary' && 'P'}
            {selection?.type === 'secondary' && 'S'}
          </span>
          {selection.comment && (
            <MessageSquare className="absolute -top-1 -right-1 h-3 w-3 text-yellow-600" />
          )}
        </span>
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
