import React, { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { calculatePercentages } from '../../../utils/planningUtils';
import DesktopTable from './DesktopTable';
import CommentModal from './CommentModal';
import Portal from './Portal';
import MobileTable from './MobileTable';
import type { Selections } from '../types';

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
  const [activeModal, setActiveModal] = useState<{
    cellKey: string;
    position: { x: number; y: number };
  } | null>(null);
  
  // Force currentPeriodOnly=false pour afficher les désidératas même s'ils correspondent
  // à des dates en dehors de la plage startDate-endDate (utile après un archivage)
  const percentages = calculatePercentages(selections, startDate, endDate, false);
  
  // Logs détaillés pour comprendre ce qui se passe
  console.log('PlanningPreview: sélections reçues:', Object.keys(selections).length, 'clés:', Object.keys(selections));
  console.log('PlanningPreview: dates:', startDate.toISOString(), '-', endDate.toISOString());
  console.log('PlanningPreview: pourcentages calculés:', percentages);
  console.log('PlanningPreview: validatedAt:', validatedAt);
  
  // Examiner le contenu exact des sélections pour comprendre le problème
  console.log('PlanningPreview: contenu des sélections:', selections);
  if (Object.keys(selections).length > 0) {
    const firstKey = Object.keys(selections)[0];
    console.log('PlanningPreview: exemple de sélection:', firstKey, selections[firstKey]);
    console.log('PlanningPreview: type de la première sélection:', selections[firstKey]?.type);
  }

  const handleCellClick = (key: string) => {
    const selection = selections[key];
    if (selection?.comment) {
      handleOpenModal(key, { x: window.innerWidth / 2, y: window.innerHeight / 3 });
    }
  };
  
  const handleOpenModal = (key: string, position: { x: number; y: number }) => {
    setActiveModal({ cellKey: key, position });
  };
  
  const handleCloseModal = () => {
    setActiveModal(null);
  };
  
  const handleComment = (key: string, comment: string) => {
    // En mode lecture seule, cette fonction ne fait rien
    console.log('Comment action not available in read-only mode');
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
          onComment={handleComment}
          onOpenModal={handleOpenModal}
          activeModal={activeModal}
          onCloseModal={handleCloseModal}
          readOnly={true}
        />
      </div>

      <div className="md:hidden">
        <MobileTable
          startDate={startDate}
          endDate={endDate}
          selections={selections}
          onCellMouseDown={handleCellClick}
          onCellMouseEnter={() => {}}
          onComment={handleComment}
          onOpenModal={handleOpenModal}
          activeModal={activeModal}
          onCloseModal={handleCloseModal}
        />
      </div>
      
      {activeModal && (
        <Portal>
          <CommentModal
            isOpen={true}
            onClose={handleCloseModal}
            onSave={() => {}}
            initialComment={selections[activeModal.cellKey].comment}
            position={activeModal.position}
            cellKey={activeModal.cellKey}
            readOnly
          />
        </Portal>
      )}
    </div>
  );
};

export default PlanningPreview;
