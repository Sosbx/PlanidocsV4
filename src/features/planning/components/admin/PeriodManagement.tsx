import React, { useState } from 'react';
import { createParisDate, formatParisDate } from '@/utils/timezoneUtils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ConfirmationModal } from '../../../../components/modals';
import { LoadingSpinner } from '../../../../components/common';
import { deletePlanningPeriod, validateBagAndMergePeriods, createPlanningPeriod } from '../../../../lib/firebase/planning';
import type { PlanningPeriod } from '../../../../types/planning';

interface PeriodManagementProps {
  allPeriods: PlanningPeriod[];
  isLoadingPeriods: boolean;
  refreshPeriods: () => Promise<void>;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

/**
 * Composant pour la gestion des périodes de planning
 */
const PeriodManagement: React.FC<PeriodManagementProps> = ({ 
  allPeriods, 
  isLoadingPeriods, 
  refreshPeriods, 
  onSuccess, 
  onError 
}) => {
  const [newPeriodName, setNewPeriodName] = useState<string>('');
  const [newPeriodStartDate, setNewPeriodStartDate] = useState<Date>(createParisDate());
  const [newPeriodEndDate, setNewPeriodEndDate] = useState<Date>(
    new Date(createParisDate().setMonth(createParisDate().getMonth() + 3))
  );
  const [newPeriodStatus, setNewPeriodStatus] = useState<'active' | 'future' | 'archived'>('future');
  const [periodToDelete, setPeriodToDelete] = useState<string | null>(null);
  const [showDeletePeriodConfirmation, setShowDeletePeriodConfirmation] = useState<boolean>(false);

  /**
   * Fonction pour créer une nouvelle période
   */
  const handleAddPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Déterminer automatiquement le statut en fonction des dates
      const today = createParisDate();
      today.setHours(0, 0, 0, 0);
      
      // Déterminer le statut automatiquement
      let autoStatus: 'active' | 'future' | 'archived';
      if (newPeriodEndDate < today) {
        // Si la période est entièrement dans le passé
        autoStatus = 'archived';
      } else if (newPeriodStartDate > today) {
        // Si la période est entièrement dans le futur
        autoStatus = 'future';
      } else {
        // Si la période contient la date d'aujourd'hui
        autoStatus = 'active';
      }
      
      // Utiliser le statut déterminé automatiquement ou celui sélectionné par l'utilisateur
      const finalStatus = newPeriodStatus || autoStatus;
      
      // Déterminer la phase BAG en fonction du statut
      let bagPhase: 'submission' | 'distribution' | 'completed';
      if (finalStatus === 'future') {
        bagPhase = 'submission';
      } else {
        bagPhase = 'completed';
      }
      
      // Déterminer si la période est validée en fonction du statut
      const isValidated = finalStatus === 'archived';
      
      const newPeriod: Omit<PlanningPeriod, 'id'> = {
        name: newPeriodName,
        startDate: newPeriodStartDate,
        endDate: newPeriodEndDate,
        status: finalStatus,
        bagPhase: bagPhase,
        isValidated: isValidated
      };
      
      // Créer la période dans Firebase
      const periodId = await createPlanningPeriod(newPeriod);
      
      // Rafraîchir les périodes
      await refreshPeriods();
      
      // Réinitialiser le formulaire
      setNewPeriodName('');
      setNewPeriodStartDate(createParisDate());
      setNewPeriodEndDate(new Date(createParisDate().setMonth(createParisDate().getMonth() + 3)));
      
      onSuccess('Période ajoutée avec succès');
    } catch (error) {
      console.error('Error adding period:', error);
      onError('Erreur lors de l\'ajout de la période');
    }
  };
  
  /**
   * Fonction pour supprimer une période
   */
  const handleDeletePeriod = async () => {
    if (!periodToDelete) return;
    
    try {
      await deletePlanningPeriod(periodToDelete);
      
      // Rafraîchir les périodes
      await refreshPeriods();
      
      onSuccess('Période supprimée avec succès');
      
      setPeriodToDelete(null);
      setShowDeletePeriodConfirmation(false);
    } catch (error) {
      console.error('Error deleting period:', error);
      onError('Erreur lors de la suppression de la période');
    }
  };
  
  /**
   * Fonction pour valider la BAG et fusionner les périodes
   */
  const handleValidateBag = async (periodId: string) => {
    try {
      await validateBagAndMergePeriods(periodId);
      
      // Rafraîchir les périodes
      await refreshPeriods();
      
      onSuccess('BAG validée et périodes fusionnées avec succès');
    } catch (error) {
      console.error('Error validating BAG:', error);
      onError('Erreur lors de la validation de la BAG');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Gestion des périodes de planning</h2>
        <p className="text-sm text-gray-500 mb-4">
          Créez et gérez les périodes de planning. Les périodes permettent d'organiser les plannings dans le temps et de gérer les phases de la bourse aux gardes.
        </p>
        
        {/* Formulaire d'ajout de période */}
        <form onSubmit={handleAddPeriod} className="mb-6 p-4 border border-gray-200 rounded-lg">
          <h3 className="text-md font-medium text-gray-800 mb-3">Ajouter une nouvelle période</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom de la période
              </label>
              <input
                type="text"
                value={newPeriodName}
                onChange={(e) => setNewPeriodName(e.target.value)}
                className="block w-full pl-4 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                placeholder="Ex: Été 2025"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Statut
              </label>
              <select
                value={newPeriodStatus}
                onChange={(e) => setNewPeriodStatus(e.target.value as 'active' | 'future' | 'archived')}
                className="block w-full pl-4 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
              >
                <option value="future">Future</option>
                <option value="active">Active</option>
                <option value="archived">Archivée</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de début
              </label>
              <input
                type="date"
                value={formatParisDate(newPeriodStartDate, 'yyyy-MM-dd')}
                onChange={(e) => setNewPeriodStartDate(new Date(e.target.value))}
                className="block w-full pl-4 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de fin
              </label>
              <input
                type="date"
                value={formatParisDate(newPeriodEndDate, 'yyyy-MM-dd')}
                onChange={(e) => setNewPeriodEndDate(new Date(e.target.value))}
                className="block w-full pl-4 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                required
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <span className="h-4 w-4 mr-2">+</span>
              Ajouter la période
            </button>
          </div>
        </form>
        
        {/* Liste des périodes */}
        <div className="overflow-hidden border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dates
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phase BAG
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoadingPeriods ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 whitespace-nowrap text-center">
                    <LoadingSpinner />
                  </td>
                </tr>
              ) : allPeriods.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 whitespace-nowrap text-center text-gray-500">
                    Aucune période définie
                  </td>
                </tr>
              ) : (
                allPeriods.map((period) => (
                  <tr key={period.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {period.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {formatParisDate(period.startDate, 'dd/MM/yyyy', { locale: fr })} - {formatParisDate(period.endDate, 'dd/MM/yyyy', { locale: fr })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        period.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : period.status === 'future'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}>
                        {period.status === 'active' 
                          ? 'Active' 
                          : period.status === 'future'
                            ? 'Future'
                            : 'Archivée'
                        }
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        period.bagPhase === 'submission' 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : period.bagPhase === 'distribution'
                            ? 'bg-orange-100 text-orange-800'
                            : period.bagPhase === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                      }`}>
                        {period.bagPhase === 'submission' 
                          ? 'Soumission' 
                          : period.bagPhase === 'distribution'
                            ? 'Distribution'
                            : period.bagPhase === 'completed'
                              ? 'Terminée'
                              : 'Non définie'
                        }
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        {period.status === 'future' && (
                          <button
                            onClick={() => handleValidateBag(period.id)}
                            className="inline-flex items-center px-3 py-1.5 border border-green-300 text-sm font-medium rounded-md text-green-700 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                          >
                            Valider BAG
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setPeriodToDelete(period.id);
                            setShowDeletePeriodConfirmation(true);
                          }}
                          className="inline-flex items-center px-3 py-1.5 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de confirmation de suppression */}
      <ConfirmationModal
        isOpen={showDeletePeriodConfirmation}
        title="Supprimer la période"
        message="Êtes-vous sûr de vouloir supprimer cette période ? Cette action est irréversible."
        confirmLabel="Supprimer"
        onConfirm={handleDeletePeriod}
        onCancel={() => {
          setShowDeletePeriodConfirmation(false);
          setPeriodToDelete(null);
        }}
      />
    </div>
  );
};

export default PeriodManagement;