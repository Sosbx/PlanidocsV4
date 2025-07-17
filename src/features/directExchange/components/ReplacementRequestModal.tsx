import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, User, Calendar, Clock } from 'lucide-react';
import { useAuth } from '../../auth/hooks';
import { useReplacementService } from '../hooks/useReplacementService';
import { format } from 'date-fns';
import { frLocale } from '../../../utils/dateLocale';
import { parseParisDate, formatParisDate } from '../../../utils/timezoneUtils';
import { standardizePeriod } from '../../../utils/periodUtils';

interface ReplacementRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  exchangeData: {
    id?: string;
    date: string;
    period: string;
    shiftType: string;
    timeSlot: string;
  };
  onSuccess?: () => void;
}

export const ReplacementRequestModal: React.FC<ReplacementRequestModalProps> = ({
  isOpen,
  onClose,
  exchangeData,
  onSuccess
}) => {
  const { user } = useAuth();
  const { proposeReplacement, loading, error } = useReplacementService();
  const [comment, setComment] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<'specific' | 'all'>('all');
  const [selectedReplacementId, setSelectedReplacementId] = useState<string>('');
  const [remplacements, setRemplacements] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  }[]>([]);
  
  // Simuler la récupération des remplaçants disponibles
  // Dans une implémentation réelle, cette liste viendrait d'une requête à la base de données
  useEffect(() => {
    // Exemple de données de remplaçants pour démo
    setRemplacements([
      { id: 'remp1', name: 'Dr. Martin' },
      { id: 'remp2', name: 'Dr. Dubois' },
      { id: 'remp3', name: 'Dr. Bernard' }
    ]);
  }, []);

  const formatPeriod = (period: string) => {
    const standardPeriod = standardizePeriod(period);
    switch (standardPeriod) {
      case 'M': return 'Matin';
      case 'AM': return 'Après-midi';
      case 'S': return 'Soir';
      default: return period;
    }
  };
  
  const formatDate = (dateString: string) => {
    try {
      return formatParisDate(dateString, 'EEEE d MMMM yyyy', { locale: frLocale });
    } catch (e) {
      return dateString;
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    try {
      const result = await proposeReplacement({
        exchangeId: exchangeData.id,
        date: exchangeData.date,
        period: exchangeData.period,
        shiftType: exchangeData.shiftType,
        timeSlot: exchangeData.timeSlot,
        comment: comment,
        isGroupProposal: selectedOption === 'all',
        targetUserId: selectedOption === 'specific' ? selectedReplacementId : undefined
      });
      
      if (result.success) {
        setSuccessMessage('Proposition de remplacement envoyée avec succès');
        setComment('');
        
        // Notifier le composant parent du succès
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1500);
        }
      }
    } catch (err) {
      console.error('Erreur lors de la proposition de remplacement:', err);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
        >
          <X className="h-5 w-5" />
        </button>
        
        <h2 className="text-xl font-semibold mb-4">Proposer un remplacement</h2>
        
        {successMessage ? (
          <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
            <div className="flex">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              <p className="text-green-700">{successMessage}</p>
            </div>
          </div>
        ) : null}
        
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        ) : null}
        
        <div className="bg-blue-50 border border-blue-100 rounded-md p-4 mb-4">
          <div className="space-y-2">
            <div className="flex items-center">
              <Calendar className="h-4 w-4 text-blue-500 mr-2" />
              <span className="text-blue-700 font-medium">{formatDate(exchangeData.date)}</span>
            </div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 text-blue-500 mr-2" />
              <span className="text-blue-700">
                {formatPeriod(exchangeData.period)} - {exchangeData.timeSlot}
              </span>
            </div>
            <div className="flex items-center">
              <User className="h-4 w-4 text-blue-500 mr-2" />
              <span className="text-blue-700">{exchangeData.shiftType}</span>
            </div>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Destinataires
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="recipient"
                  value="all"
                  checked={selectedOption === 'all'}
                  onChange={() => setSelectedOption('all')}
                  className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">Tous les remplaçants</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="recipient"
                  value="specific"
                  checked={selectedOption === 'specific'}
                  onChange={() => setSelectedOption('specific')}
                  className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">Remplaçant spécifique</span>
              </label>
              
              {selectedOption === 'specific' && (
                <div className="ml-6 mt-2">
                  <select
                    value={selectedReplacementId}
                    onChange={(e) => setSelectedReplacementId(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                    required={selectedOption === 'specific'}
                  >
                    <option value="">Sélectionner un remplaçant</option>
                    {remplacements.map((remp) => (
                      <option key={remp.id} value={remp.id}>
                        {remp.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
          
          <div>
            <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-1">
              Message (facultatif)
            </label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
              placeholder="Ajoutez des informations supplémentaires pour le remplaçant"
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
              disabled={loading || (selectedOption === 'specific' && !selectedReplacementId)}
            >
              {loading ? 'Envoi...' : 'Proposer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};