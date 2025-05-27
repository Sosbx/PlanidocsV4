import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useDirectExchangeTransactions } from '../hooks';

/**
 * Props du composant d'historique des échanges
 */
interface ExchangeHistoryProps {
  limit?: number;
  className?: string;
}

/**
 * Composant d'affichage de l'historique des échanges
 * Utilise le nouveau système de transaction pour récupérer l'historique
 */
export const ExchangeHistory: React.FC<ExchangeHistoryProps> = ({
  limit = 10,
  className = ''
}) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Utiliser le hook de transactions pour récupérer l'historique
  const { 
    getUserExchangeHistory,
    isProcessing 
  } = useDirectExchangeTransactions();
  
  // Charger l'historique au chargement du composant
  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true);
      try {
        const historyData = await getUserExchangeHistory(limit);
        setHistory(historyData);
      } catch (error) {
        console.error('Erreur lors du chargement de l\'historique:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadHistory();
  }, [getUserExchangeHistory, limit]);
  
  // Formater la date pour l'affichage
  const formatDate = (date: Date) => {
    return format(date, 'dd MMMM yyyy à HH:mm', { locale: fr });
  };
  
  if (loading || isProcessing) {
    return (
      <div className={`p-4 bg-white rounded-lg shadow ${className}`}>
        <h3 className="text-lg font-semibold mb-4">Historique des échanges</h3>
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }
  
  if (history.length === 0) {
    return (
      <div className={`p-4 bg-white rounded-lg shadow ${className}`}>
        <h3 className="text-lg font-semibold mb-4">Historique des échanges</h3>
        <p className="text-gray-500 text-center py-6">
          Aucun échange dans votre historique
        </p>
      </div>
    );
  }
  
  return (
    <div className={`p-4 bg-white rounded-lg shadow ${className}`}>
      <h3 className="text-lg font-semibold mb-4">Historique des échanges</h3>
      
      <div className="overflow-hidden overflow-y-auto max-h-80">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Opération
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Garde
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Avec
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {history.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(item.date)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    item.operation === 'Garde cédée' ? 'bg-red-100 text-red-800' :
                    item.operation === 'Garde reprise' ? 'bg-green-100 text-green-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {item.operation}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.shift}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.withUser}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExchangeHistory;