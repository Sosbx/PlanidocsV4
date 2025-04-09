import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Repeat, Trash2 } from 'lucide-react';
import { removeShiftExchange, getShiftExchanges, subscribeToShiftExchanges } from '../../lib/firebase/shifts';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '../../features/auth';
import { ShiftExchange } from '../../types/planning';

const PERIOD_NAMES = {
  'M': 'Matin',
  'AM': 'Après-midi',
  'S': 'Soir'
} as const;

type Period = keyof typeof PERIOD_NAMES;

interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (comment: string) => void;
  onExchange?: (comment: string) => void;
  onRemoveExchange?: () => void;
  initialComment?: string;
  position: { x: number; y: number };
  cellKey: string;
  readOnly?: boolean;
}

const CommentModal: React.FC<CommentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onExchange,
  onRemoveExchange,
  initialComment = '',
  position,
  cellKey,
  readOnly = false
}) => {
  const [comment, setComment] = useState(initialComment);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isInExchange, setIsInExchange] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [exchanges, setExchanges] = useState<ShiftExchange[]>([]);
  const { user } = useAuth();

  // Extraire la date et la période du cellKey
  const parts = cellKey.split('-');
  const dateStr = parts.slice(0, 3).join('-'); // Récupère YYYY-MM-DD
  const period = parts[3] as Period; // Récupère la période (M, AM, S)
  const date = new Date(dateStr);
  const periodName = PERIOD_NAMES[period];

  useEffect(() => {
    setComment(initialComment);
  }, [initialComment]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!user) return;
    
    setIsLoading(true);
    
    // Extraire la date et la période du cellKey pour la vérification
    const parts = cellKey.split('-');
    const date = parts.slice(0, 3).join('-'); // YYYY-MM-DD
    const period = parts[3]; // M, AM, or S
    
    // S'abonner aux changements en temps réel des échanges
    const unsubscribe = subscribeToShiftExchanges((exchangeData) => {
      setExchanges(exchangeData);
      
      // Vérifier si la garde est dans la bourse aux gardes
      const isExchanged = exchangeData.some(e => 
        e.date === date && 
        e.period === period && 
        e.userId === user.id &&
        e.status === 'pending' // S'assurer que l'échange est toujours actif
      );
      
      setIsInExchange(isExchanged);
      setIsLoading(false);
    });
    
    // Se désabonner lorsque le composant est démonté
    return () => {
      unsubscribe();
    };
  }, [cellKey, user]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(comment);
    onClose();
  };

  const modalStyle = isMobile ? {
    top: '0',
    left: '0',
    right: '0',
    transform: 'none',
    margin: '0',
    width: '100%',
    borderRadius: '0 0 0.5rem 0.5rem'
  } : {
    top: `${position.y}px`,
    left: `${position.x}px`,
    transform: 'translate(-50%, -100%)',
    marginTop: '-10px'
  };

  return (
    <div 
      className="fixed z-50 bg-white shadow-xl border border-gray-200"
      style={modalStyle}
    >
      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-medium text-gray-900">Commentaire</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 space-y-2">
          <div className="flex items-center text-sm text-gray-600">
            <Calendar className="h-4 w-4 mr-2" />
            <span className="capitalize">
              {format(date, 'EEEE d MMMM yyyy', { locale: fr })}
            </span>
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <Clock className="h-4 w-4 mr-2" />
            <span>{periodName}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className={`w-full min-w-[200px] h-24 px-3 py-2 text-sm border border-gray-300 rounded-md transition-colors ${
              readOnly ? 'bg-gray-50' : 'focus:ring-indigo-500 focus:border-indigo-500'
            }`}
            placeholder="Ajouter un commentaire..."
            autoFocus
            readOnly={readOnly}
          />
          <div className="flex justify-end gap-2">
            {!readOnly && (
              <>
                {onExchange && !isLoading && (
                  isInExchange ? (
                    <button
                      type="button"
                      onClick={() => {
                        // Utiliser uniquement la fonction onRemoveExchange fournie par le parent
                        if (onRemoveExchange) {
                          onRemoveExchange();
                        }
                        onClose();
                      }}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-800 bg-red-100 border border-red-300 rounded-md hover:bg-red-200 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Retirer de la BaG
                    </button>
                  ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onExchange(comment);
                      onClose();
                    }}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-yellow-800 bg-yellow-100 border border-yellow-300 rounded-md hover:bg-yellow-200 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Repeat className="h-4 w-4 mr-2" />
                    BaG
                  </button>
                  )
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Annuler
                </button>
              </>
            )}
            {readOnly && (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Fermer
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default CommentModal;
