import React, { useState } from 'react';
import { Clock, Check, RefreshCw, Eye, Download, X } from 'lucide-react';
import { useBagPhase } from '../../context/BagPhaseContext';
import { getTimeRemaining } from '../../utils/timeUtils';
import { getExchangeHistory } from '../../lib/firebase/shifts';
import { useUsers } from '../../context/UserContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ShiftPeriod } from '../../types/exchange';
import { getPeriodDisplayText } from '../../utils/dateUtils';

const BagPhaseIndicator: React.FC = () => {
  const { config } = useBagPhase();
  const { users } = useUsers();
  const [timeLeft, setTimeLeft] = React.useState(getTimeRemaining(config.submissionDeadline));

  React.useEffect(() => {
    if (config.phase !== 'submission') return;

    const timer = setInterval(() => {
      const remaining = getTimeRemaining(config.submissionDeadline);
      setTimeLeft(remaining);
      
      if (remaining.isExpired) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [config.submissionDeadline, config.phase]);

  const [showPreview, setShowPreview] = useState(false);
  const [exchangeData, setExchangeData] = useState<any[]>([]);

  const generateExchangeSummary = async () => {
    const history = await getExchangeHistory();
    return history.map(exchange => {
      const donorUser = users.find(u => u.id === exchange.originalUserId);
      const receiverUser = users.find(u => u.id === exchange.newUserId);
      
      return {
        date: format(new Date(exchange.date), 'dd/MM/yyyy', { locale: fr }),
        donor: donorUser ? `${donorUser.lastName} ${donorUser.firstName}` : 'Inconnu',
        shift: exchange.shiftType,
        period: getPeriodDisplayText(exchange.period as ShiftPeriod),
        receiver: receiverUser ? `${receiverUser.lastName} ${receiverUser.firstName}` : 'Inconnu',
        type: exchange.isPermutation ? 'Échange' : 'Cède',
        comment: exchange.comment || ''
      };
    });
  };

  const handlePreview = async () => {
    const data = await generateExchangeSummary();
    setExchangeData(data);
    setShowPreview(true);
  };

  const handleDownloadPDF = async () => {
    const data = await generateExchangeSummary();
    
    const doc = new jsPDF();
    
    // Titre
    doc.setFontSize(16);
    doc.text('Récapitulatif des échanges de garde', 14, 20);
    
    // Date d'export
    doc.setFontSize(10);
    doc.text(`Exporté le ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })}`, 14, 30);

    // Tableau
    autoTable(doc, {
      startY: 40,
      head: [['Date', 'Période', 'Donneur', 'Garde', 'Receveur', 'Type', 'Commentaire']],
      body: data.map(row => [
        row.date,
        row.period,
        row.donor,
        row.shift,
        row.receiver,
        row.type,
        row.comment
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] }
    });

    doc.save(`Récapitulatif_échanges_${format(new Date(), 'dd-MM-yyyy')}.pdf`);
  };
  
  if (!config.isConfigured) return null;

  const renderPhaseContent = () => {
    switch (config.phase) {
      case 'submission':
        return (
          <div className="bg-blue-50 text-blue-800 px-2 py-1 rounded-md inline-flex items-center text-xs font-medium">
            <Clock className="h-4 w-4 mr-1.5 text-blue-600" />
            <span>Phase d'échange</span>
            {/* Affichage du temps restant simplifié (jours et heures seulement) */}
            <span className="ml-2 text-blue-900 bg-blue-100 px-1.5 py-0.5 rounded">
              {timeLeft.days > 0 ? `${timeLeft.days}j ` : ''}
              {String(timeLeft.hours).padStart(2, '0')}h
            </span>
          </div>
        );

      case 'distribution':
        return (
          <div className="bg-amber-50 text-amber-800 px-2 py-1 rounded-md inline-flex items-center text-xs font-medium">
            <RefreshCw className="h-4 w-4 mr-1.5 text-amber-600" />
            <span>Répartition en cours</span>
          </div>
        );

      case 'completed':
        return (
          <div className="flex items-center gap-4">
            <div className="bg-green-50 text-green-800 px-2 py-1 rounded-md inline-flex items-center text-xs font-medium">
              <Check className="h-4 w-4 mr-1.5 text-green-600" />
              <span>Terminé</span>
            </div>
            <button
              onClick={handlePreview}
              className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              Aperçu
            </button>
            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              PDF
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="mb-0">
      {renderPhaseContent()}
      
      {/* Modal d'aperçu */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Récapitulatif des échanges</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Période
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Donneur
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Garde
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Receveur
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Commentaire
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {exchangeData.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.period}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.donor}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.shift}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.receiver}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          row.type === 'Échange' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{row.comment}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BagPhaseIndicator;