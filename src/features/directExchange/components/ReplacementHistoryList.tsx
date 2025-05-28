import React, { useState, useEffect } from 'react';
import { Calendar, User, MessageSquare, CheckCircle, XCircle, HistoryIcon } from 'lucide-react';
import { useReplacementService } from '../hooks/useReplacementService';
import { format, isAfter, isBefore, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { standardizePeriod } from '../../../utils/periodUtils';

/**
 * Composant affichant l'historique des remplacements pour un utilisateur
 */
export const ReplacementHistoryList: React.FC = () => {
  const { 
    getReplacementHistory, 
    isReplacementUser, 
    loading: serviceLoading 
  } = useReplacementService();
  
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({});
  
  // Charger l'historique des remplacements
  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await getReplacementHistory();
      
      if (result.error) {
        setError(result.error);
      } else {
        setHistory(result.history);
      }
    } catch (err) {
      setError('Erreur lors du chargement de l\'historique');
      console.error('Error loading replacement history:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Charger l'historique au montage du composant
  useEffect(() => {
    loadHistory();
  }, []);
  
  // Formater la période pour l'affichage
  const formatPeriod = (period: string) => {
    const standardPeriod = standardizePeriod(period);
    switch (standardPeriod) {
      case 'M': return 'Matin';
      case 'AM': return 'Après-midi';
      case 'S': return 'Soir';
      default: return period;
    }
  };
  
  // Formater la date pour l'affichage
  const formatDate = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      return format(date, 'EEE d MMM yyyy', { locale: fr });
    } catch (e) {
      return dateString;
    }
  };
  
  // Filtrer l'historique selon le filtre actif
  const filteredHistory = history.filter(item => {
    if (filter === 'all') return true;
    
    try {
      const date = parseISO(item.date);
      const today = new Date();
      
      if (filter === 'upcoming') {
        return isAfter(date, today) || 
               (format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'));
      } else {
        return isBefore(date, today) && 
               (format(date, 'yyyy-MM-dd') !== format(today, 'yyyy-MM-dd'));
      }
    } catch (e) {
      return true;
    }
  });
  
  // Basculer l'affichage des détails pour un élément
  const toggleDetails = (id: string) => {
    setShowDetails(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  
  // Affichage pendant le chargement
  if (loading) {
    return (
      <div className="p-4 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        <span className="ml-2 text-gray-600">Chargement de l'historique...</span>
      </div>
    );
  }
  
  // Affichage en cas d'erreur
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-700">{error}</p>
        <button 
          onClick={loadHistory}
          className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200"
        >
          Réessayer
        </button>
      </div>
    );
  }
  
  // Si aucun historique
  if (history.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-md p-6 text-center">
        <HistoryIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-gray-700 text-lg font-medium mb-1">Aucun historique de remplacement</h3>
        <p className="text-gray-500">
          {isReplacementUser 
            ? "Vous n'avez pas encore effectué de remplacements."
            : "Vous n'avez pas encore proposé de remplacements."
          }
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Titre et filtres */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">
          Historique des remplacements
        </h3>
        
        <div className="flex border border-gray-300 rounded-md overflow-hidden">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-sm ${filter === 'all' 
              ? 'bg-indigo-50 text-indigo-700 font-medium' 
              : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Tous
          </button>
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-3 py-1.5 text-sm border-l border-gray-300 ${filter === 'upcoming' 
              ? 'bg-indigo-50 text-indigo-700 font-medium' 
              : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            À venir
          </button>
          <button
            onClick={() => setFilter('past')}
            className={`px-3 py-1.5 text-sm border-l border-gray-300 ${filter === 'past' 
              ? 'bg-indigo-50 text-indigo-700 font-medium' 
              : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Passés
          </button>
        </div>
      </div>
      
      {/* Liste des remplacements */}
      <div className="space-y-3">
        {filteredHistory.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 text-center">
            <p className="text-gray-600">Aucun remplacement trouvé avec ce filtre.</p>
          </div>
        ) : (
          filteredHistory.map((item) => (
            <div 
              key={item.id} 
              className="border border-gray-200 rounded-lg shadow-sm overflow-hidden"
            >
              {/* En-tête avec la date */}
              <div 
                className="px-4 py-3 border-b border-gray-200 flex justify-between items-center cursor-pointer hover:bg-gray-50"
                onClick={() => toggleDetails(item.id)}
              >
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="font-medium text-gray-900">
                    {formatDate(item.date)}
                  </span>
                  <span className="ml-2 text-sm text-gray-500">
                    {formatPeriod(item.period)} - {item.timeSlot}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    item.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : item.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                  }`}>
                    {item.status === 'completed' ? 'Effectué' : 
                     item.status === 'pending' ? 'En attente' : 
                     'Annulé'}
                  </span>
                  <button 
                    className="ml-2 text-gray-400 hover:text-gray-700"
                    aria-label={showDetails[item.id] ? 'Masquer les détails' : 'Afficher les détails'}
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className={`h-5 w-5 transition-transform ${showDetails[item.id] ? 'transform rotate-180' : ''}`} 
                      viewBox="0 0 20 20" 
                      fill="currentColor"
                    >
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Détails (conditionnellement affichés) */}
              {showDetails[item.id] && (
                <div className="px-4 py-3 bg-gray-50">
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Médecin remplacé</div>
                      <div className="flex items-center">
                        <User className="h-4 w-4 text-gray-500 mr-1.5" />
                        <span className="text-sm text-gray-700">
                          {item.originalUserName || 'N/A'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Remplaçant</div>
                      <div className="flex items-center">
                        <User className="h-4 w-4 text-gray-500 mr-1.5" />
                        <span className="text-sm text-gray-700">
                          {item.newUserName || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Commentaire s'il existe */}
                  {item.comment && (
                    <div className="border-t border-gray-200 pt-3">
                      <div className="flex items-start">
                        <MessageSquare className="h-4 w-4 text-gray-500 mr-1.5 mt-0.5" />
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Commentaire</div>
                          <p className="text-sm text-gray-700">{item.comment}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};