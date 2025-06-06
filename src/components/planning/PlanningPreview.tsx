import React, { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { calculatePercentages } from '../../utils/planningUtils';
import DesktopTable from './DesktopTable';
import CommentModal from '../CommentModal';
import Portal from '../Portal';
import MobileTable from './MobileTable';
import type { Selections } from '../../types/planning';

interface PlanningPreviewProps {
  user: {
    firstName: string;
    lastName: string;
  };
  selections: Selections;
  validatedAt: string;
  startDate: Date;
  endDate: Date;
  primaryLimit?: number;
  secondaryLimit?: number;
}

const PlanningPreview: React.FC<PlanningPreviewProps> = ({
  user,
  selections,
  validatedAt,
  startDate,
  endDate,
  primaryLimit,
  secondaryLimit,
}) => {
  const [selectedCell, setSelectedCell] = useState<{
    key: string;
    position: { x: number; y: number };
  } | null>(null);
  
  const percentages = calculatePercentages(selections, startDate, endDate);

  const handleCellClick = (key: string, event: React.MouseEvent) => {
    const selection = selections[key];
    if (selection?.comment) {
      setSelectedCell({
        key,
        position: { x: event.clientX, y: event.clientY }
      });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6 space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">
          Planning de {user.firstName} {user.lastName}
        </h1>
        <div className="flex items-center gap-8">
          <p className="text-sm text-gray-500">
            Validé le {format(new Date(validatedAt), 'dd MMMM yyyy à HH:mm', { locale: fr })}
          </p>
          {primaryLimit !== undefined && secondaryLimit !== undefined && (
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-100 border-2 border-red-600"></span>
                <span className="text-gray-600">Primaire:</span>
                <span className={`font-medium ${percentages.primary > primaryLimit ? 'text-red-600' : 'text-gray-900'}`}>
                  {percentages.primary.toFixed(1)}%
                </span>
                <span className="text-gray-500">/{primaryLimit}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-100 border-2 border-blue-600"></span>
                <span className="text-gray-600">Secondaire:</span>
                <span className={`font-medium ${percentages.secondary > secondaryLimit ? 'text-red-600' : 'text-gray-900'}`}>
                  {percentages.secondary.toFixed(1)}%
                </span>
                <span className="text-gray-500">/{secondaryLimit}%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="hidden md:block">
        <DesktopTable
          startDate={startDate}
          endDate={endDate}
          selections={selections}
          onCellMouseDown={handleCellClick}
          onCellMouseEnter={() => {}}
          onComment={() => {}}
          readOnly
        />
      </div>

      <div className="md:hidden">
        <MobileTable
          startDate={startDate}
          endDate={endDate}
          selections={selections}
          onCellMouseDown={handleCellClick}
          onCellMouseEnter={() => {}}
          onComment={() => {}}
          readOnly
        />
      </div>
      
      {selectedCell && (
        <Portal>
          <CommentModal
            isOpen={true}
            onClose={() => setSelectedCell(null)}
            onSave={() => {}}
            initialComment={selections[selectedCell.key].comment}
            position={selectedCell.position}
            cellKey={selectedCell.key}
            readOnly
          />
        </Portal>
      )}
    </div>
  );
};

export default PlanningPreview;