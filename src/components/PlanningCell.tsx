import React, { useState, useCallback } from 'react';
import { MessageSquare } from 'lucide-react';
import CommentModal from './CommentModal';
import Portal from './Portal';
import type { PeriodSelection } from '../types/planning';

interface PlanningCellProps {
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

const PlanningCell: React.FC<PlanningCellProps> = ({
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

  const handleMouseDown = (e: React.MouseEvent) => {
    // Ne déclencher que pour le clic gauche (button 0) et si pas en lecture seule
    if (readOnly) {
      onMouseDown(cellKey, e);
    } else if (!isModalOpen && e.button === 0) {
      onMouseDown(cellKey, e);
    }
  };

  const handleMouseEnter = () => {
    if (!readOnly && !isModalOpen) {
      onMouseEnter(cellKey);
    }
  };

  const getCellClasses = () => {
    const baseClasses = `${selection.comment ? 'border-2 border-black' : 'border'} px-2 py-1 text-center select-none transition-colors`;
    const cursorClasses = readOnly ? 'cursor-default' : 'cursor-pointer';
    const commentCursor = selection?.type !== null ? 'context-menu' : 'default';
    const hasComment = Boolean(selection.comment);
    const isWeekend = isGrayedOut; // Renommé pour plus de clarté

    let colorClasses = '';
    if (selection?.type === 'primary') {
      colorClasses = hasComment
        ? 'bg-yellow-50 text-red-800' 
        : isWeekend 
          ? 'bg-red-200 text-red-900'
          : 'bg-red-100 text-red-800';
      colorClasses += ` ${commentCursor}`;
    } else if (selection?.type === 'secondary') {
      colorClasses = hasComment
        ? 'bg-yellow-50 text-blue-800' 
        : isWeekend
          ? 'bg-blue-200 text-blue-900'
          : 'bg-blue-100 text-blue-800';
      colorClasses += ` ${commentCursor}`;
    } else if (isWeekend) {
      colorClasses = 'bg-gray-100';
    } else {
      colorClasses = readOnly ? '' : 'hover:bg-gray-50';
    }

    return `${baseClasses} ${colorClasses} ${cursorClasses}`;
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

export default PlanningCell;
