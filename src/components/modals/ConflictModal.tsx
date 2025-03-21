import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ShiftExchange } from '../../types/planning';
import type { User } from '../../types/users';

interface ConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  exchange: ShiftExchange | null;
  exchangeUser: User | null;
}

const ConflictModal: React.FC<ConflictModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  exchange,
  exchangeUser
}) => {
  if (!isOpen || !exchange) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-start mb-4">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-gray-900">
              Attention : Conflit détecté
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              Vous avez déjà une garde prévue sur ce créneau. Voulez-vous quand même vous positionner sur la garde de {exchangeUser?.firstName} {exchangeUser?.lastName} ?
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 border border-transparent rounded-md hover:bg-yellow-700"
          >
            Confirmer quand même
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictModal