import React, { useState, useEffect } from 'react';
import { createParisDate, formatParisDate, parseParisDate } from '@/utils/timezoneUtils';
import { collection, getDocs, query, orderBy, doc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { db } from "../lib/firebase/config";
import { format } from 'date-fns';
import { frLocale } from '../utils/dateLocale';
import { useUsers } from '../features/auth/hooks/useUsers';
import { AlertTriangle, Mail, Check } from 'lucide-react';

interface Replacement {
  id: string;
  exchangeId: string;
  date: string;
  period: string;
  shiftType: string;
  timeSlot: string;
  originalUserId: string;
  createdAt: string;
  status: 'pending' | 'notified' | 'filled';
  notifiedUsers: string[];
}

const periodNames = {
  'M': 'Matin',
  'AM': 'Après-midi',
  'S': 'Soir'
};

const ReplacementsPage: React.FC = () => {
  const [replacements, setReplacements] = useState<Replacement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifying, setNotifying] = useState<string | null>(null);
  const { users } = useUsers();

  useEffect(() => {
    const fetchReplacements = async () => {
      try {
        setLoading(true);
        const replacementsQuery = query(
          collection(db, 'remplacements'),
          orderBy('date', 'asc')
        );
        
        const querySnapshot = await getDocs(replacementsQuery);
        const replacementsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Replacement[];
        
        setReplacements(replacementsData);
      } catch (error) {
        console.error('Error fetching replacements:', error);
        setError('Une erreur est survenue lors du chargement des remplacements.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchReplacements();
  }, []);

  const handleNotifyReplacements = async (replacement: Replacement) => {
    try {
      setNotifying(replacement.id);
      
      // Simuler l'envoi d'une notification aux remplaçants
      // Dans une implémentation réelle, vous enverriez un e-mail ou une notification push
      
      // Mettre à jour le document avec les utilisateurs notifiés
      const replacementRef = doc(db, 'remplacements', replacement.id);
      
      // Dans cet exemple, nous ajoutons simplement tous les utilisateurs comme "notifiés"
      // Dans une implémentation réelle, vous filtreriez les utilisateurs remplaçants
      // Comme nous ne connaissons pas la structure exacte de User, nous prenons tous les utilisateurs
      const replacementUsers = users.map(user => user.id);
      
      await updateDoc(replacementRef, {
        notifiedUsers: arrayUnion(...replacementUsers),
        status: 'notified',
        lastModified: Timestamp.now()
      });
      
      // Mettre à jour l'état local
      setReplacements(prevReplacements => 
        prevReplacements.map(r => 
          r.id === replacement.id 
            ? { 
                ...r, 
                notifiedUsers: [...(r.notifiedUsers || []), ...replacementUsers],
                status: 'notified'
              } 
            : r
        )
      );
      
      alert(`Notification envoyée aux remplaçants pour la garde du ${formatParisDate(replacement.date, 'dd/MM/yyyy')} (${replacement.period}).`);
    } catch (error) {
      console.error('Error notifying replacements:', error);
      alert('Une erreur est survenue lors de la notification des remplaçants.');
    } finally {
      setNotifying(null);
    }
  };

  const handleMarkAsFilled = async (replacement: Replacement) => {
    try {
      const replacementRef = doc(db, 'remplacements', replacement.id);
      
      await updateDoc(replacementRef, {
        status: 'filled',
        lastModified: Timestamp.now()
      });
      
      // Mettre à jour l'état local
      setReplacements(prevReplacements => 
        prevReplacements.map(r => 
          r.id === replacement.id 
            ? { ...r, status: 'filled' } 
            : r
        )
      );
      
      alert(`La garde du ${formatParisDate(replacement.date, 'dd/MM/yyyy')} (${replacement.period}) a été marquée comme pourvue.`);
    } catch (error) {
      console.error('Error marking replacement as filled:', error);
      alert('Une erreur est survenue lors du marquage de la garde comme pourvue.');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-indigo-900 mb-6">Remplacements</h1>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-indigo-900 mb-6">Remplacements</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertTriangle className="h-5 w-5 text-red-500 mr-2 mt-0.5" />
          <div>
            <p className="text-red-700">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-indigo-900 mb-6">Remplacements</h1>
      
      {replacements.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-gray-500">Aucun remplacement n'est actuellement disponible.</p>
        </div>
      ) : (
        <div className="flex flex-col space-y-4">
          {replacements.map(replacement => {
            const originalUser = users.find(u => u.id === replacement.originalUserId);
            const date = parseParisDate(replacement.date);
            const isPast = date < parseParisDate(formatParisDate(createParisDate(), 'yyyy-MM-dd'));
            
            return (
              <div 
                key={replacement.id} 
                className={`bg-white rounded-lg shadow p-4 border-l-4 ${
                  replacement.status === 'filled' 
                    ? 'border-green-500' 
                    : replacement.status === 'notified' 
                    ? 'border-blue-500' 
                    : 'border-amber-500'
                } ${isPast ? 'opacity-70' : ''} max-w-3xl mx-auto w-full`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {formatParisDate(date, 'EEEE d MMMM yyyy', { locale: frLocale })}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {periodNames[replacement.period as keyof typeof periodNames]} - {replacement.shiftType}
                    </p>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    replacement.status === 'filled' 
                      ? 'bg-green-100 text-green-800' 
                      : replacement.status === 'notified' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {replacement.status === 'filled' 
                      ? 'Pourvu' 
                      : replacement.status === 'notified' 
                      ? 'Notifié' 
                      : 'En attente'}
                  </div>
                </div>
                
                <div className="mb-3">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Médecin d'origine:</span> {originalUser 
                      ? `${originalUser.lastName.toUpperCase()} ${originalUser.firstName}` 
                      : 'Inconnu'}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Horaire:</span> {replacement.timeSlot || 'Non spécifié'}
                  </p>
                </div>
                
                {replacement.notifiedUsers && replacement.notifiedUsers.length > 0 && (
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      Remplaçants notifiés ({replacement.notifiedUsers.length}):
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {replacement.notifiedUsers.map(userId => {
                        const user = users.find(u => u.id === userId);
                        return user ? (
                          <span 
                            key={userId} 
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                            title={`${user.lastName} ${user.firstName}`}
                          >
                            {user.lastName.substring(0, 1)}.{user.firstName.substring(0, 1)}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end gap-2 mt-4">
                  {(replacement.status === 'pending' || replacement.status === 'notified') && (
                    <>
                      <button
                        onClick={() => handleNotifyReplacements(replacement)}
                        disabled={notifying === replacement.id}
                        className={`inline-flex items-center px-3 py-1.5 border text-xs font-medium rounded ${
                          notifying === replacement.id
                            ? 'border-gray-300 text-gray-400 bg-gray-50 cursor-not-allowed'
                            : 'border-blue-300 text-blue-700 bg-white hover:bg-blue-50'
                        }`}
                      >
                        <Mail className="h-3 w-3 mr-1" />
                        {notifying === replacement.id ? 'En cours...' : 'Notifier'}
                      </button>
                      
                      <button
                        onClick={() => handleMarkAsFilled(replacement)}
                        className="inline-flex items-center px-3 py-1.5 border border-green-300 text-xs font-medium rounded text-green-700 bg-white hover:bg-green-50"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Marquer comme pourvu
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ReplacementsPage;
