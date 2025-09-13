import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, BarChart, ArrowDownUp, Filter, ChevronUp, ChevronDown } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from "../../../lib/firebase/config";
import type { ExchangeHistory } from '../types';
import type { ShiftExchange as FeatureShiftExchange } from '../types';
import type { ShiftExchange as PlanningShiftExchange } from '../../../types/planning';
import { calculatePercentage, calculateSuccessRate, calculateUserStats } from '../../../utils/bagStatistics';

// Type union pour accepter les deux types de ShiftExchange
type ShiftExchange = FeatureShiftExchange | PlanningShiftExchange;
import type { User } from '../../../types/users';
import { isGrayedOut } from '../../../utils/dateUtils';
import Toast from '../../../components/common/Toast';
import '../../../styles/BadgeStyles.css';

// Forcer un rendu initial du tableau
let initialRenderComplete = false;

interface BagStatsVizProps {
  users: User[];
  exchanges: ShiftExchange[];
  history: ExchangeHistory[];
  className?: string;
}

// Définir des couleurs de base pour les périodes
const PERIOD_COLORS = {
  'M': 'badge-morning',
  'AM': 'badge-afternoon', 
  'S': 'badge-evening'
};

const PERIOD_NAMES = {
  'M': 'Matin',
  'AM': 'Après-midi',
  'S': 'Soir'
};

type StatsFilter = {
  period: string; // 'M', 'AM', 'S' ou 'all'
  dayType: string; // 'weekday', 'weekend', 'holiday', 'all'
  userId: string; // ID de l'utilisateur ou 'all'
};

type SortColumn = 'name' | 'proposedTotal' | 'positionedTotal' | 'receivedTotal' | 'balance' | 'weekendOrHoliday';
type SortDirection = 'asc' | 'desc';

/**
 * Composant de visualisation des statistiques de la bourse aux gardes
 * Affiche des tableaux et graphiques sur l'activité des utilisateurs
 * 
 * @param users - Liste des utilisateurs
 * @param exchanges - Liste des échanges
 * @param history - Historique des échanges
 * @param className - Classes CSS additionnelles
 */
const BagStatsViz: React.FC<BagStatsVizProps> = ({ users, exchanges, history, className = '' }) => {
  console.log('BagStatsViz - Props reçues:', {
    usersLength: users?.length || 0,
    exchangesLength: exchanges?.length || 0,
    historyLength: history?.length || 0,
    users,
    exchanges,
    history
  });
  
  const [filter, setFilter] = useState<StatsFilter>({
    period: 'all',
    dayType: 'all',
    userId: 'all'
  });
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' as 'success' | 'error' | 'info' });
  // Par défaut on commence en mode tableau, mais on le forcera à se recharger
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  // État pour le tri
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Effet pour forcer un rechargement du tableau au premier affichage
  useEffect(() => {
    // Si les données sont disponibles, forcer le rechargement une seule fois
    if (users?.length > 0 && (exchanges?.length > 0 || history?.length > 0)) {
      // On simule un changement de mode pour forcer un rechargement
      if (!initialRenderComplete) {
        console.log("Forcing stats table refresh");
        setViewMode('chart');
        setTimeout(() => {
          setViewMode('table');
          initialRenderComplete = true;
        }, 50);
      }
    }
  }, [users, exchanges, history]);

  // Utiliser les fonctions centralisées pour calculer les stats
  const statsData = useMemo(() => {
    console.log('BagStatsViz - Calcul des stats:', {
      usersCount: users?.length || 0,
      exchangesCount: exchanges?.length || 0,
      historyCount: history?.length || 0,
      hasData: !!(users && exchanges && history)
    });
    
    if (!users || !exchanges || !history) return [];

    // Créer un tableau d'objets pour chaque utilisateur
    const userStats = users
      .filter(user => user.roles.isUser) // Seulement les utilisateurs (pas les admin)
      .map(user => {
        // Utiliser calculateUserStats pour obtenir toutes les stats
        const stats = calculateUserStats(user.id, exchanges, history);

        // Calculer des pourcentages pour l'affichage
        const totalActions = stats.proposedCount + stats.positionedCount + stats.receivedCount;
        const proposedPercent = calculatePercentage(stats.proposedCount, totalActions);
        const positionedPercent = calculatePercentage(stats.positionedCount, totalActions);
        const receivedPercent = calculatePercentage(stats.receivedCount, totalActions);
        
        // Calculer l'équilibre
        const balance = stats.receivedCount - stats.givenCount;

        return {
          id: user.id,
          name: `${user.lastName} ${user.firstName}`,
          proposedTotal: stats.proposedCount,
          positionedTotal: stats.positionedCount,
          receivedTotal: stats.receivedCount,
          givenTotal: stats.givenCount,
          proposedByPeriod: stats.proposedByPeriod,
          receivedByPeriod: stats.receivedByPeriod,
          weekendOrHoliday: stats.weekendHolidayCount,
          proposedPercent,
          positionedPercent,
          receivedPercent,
          balance,
          successRate: stats.successRate
        };
      })
      // Tri par nom
      .sort((a, b) => a.name.localeCompare(b.name));

    console.log('BagStatsViz - Stats calculées:', {
      userStatsCount: userStats.length,
      firstUser: userStats[0]
    });

    return userStats;
  }, [users, exchanges, history]);

  // Calculer les totaux pour la ligne récapitulative
  const totalStats = useMemo(() => {
    if (!statsData?.length) return null;

    const totalProposed = statsData.reduce((sum, user) => sum + user.proposedTotal, 0);
    const totalPositioned = statsData.reduce((sum, user) => sum + user.positionedTotal, 0);
    const totalReceived = statsData.reduce((sum, user) => sum + user.receivedTotal, 0);
    const totalGiven = statsData.reduce((sum, user) => sum + user.givenTotal, 0);
    
    const totalByPeriod = {
      M: statsData.reduce((sum, user) => sum + user.proposedByPeriod.M, 0),
      AM: statsData.reduce((sum, user) => sum + user.proposedByPeriod.AM, 0),
      S: statsData.reduce((sum, user) => sum + user.proposedByPeriod.S, 0)
    };

    const receivedByPeriod = {
      M: statsData.reduce((sum, user) => sum + user.receivedByPeriod.M, 0),
      AM: statsData.reduce((sum, user) => sum + user.receivedByPeriod.AM, 0),
      S: statsData.reduce((sum, user) => sum + user.receivedByPeriod.S, 0)
    };

    const weekendOrHoliday = statsData.reduce((sum, user) => sum + user.weekendOrHoliday, 0);
    
    // Calculer les pourcentages globaux
    const totalActions = totalProposed + totalPositioned + totalReceived;
    const proposedPercent = calculatePercentage(totalProposed, totalActions);
    const positionedPercent = calculatePercentage(totalPositioned, totalActions);
    const receivedPercent = calculatePercentage(totalReceived, totalActions);

    return {
      proposedTotal: totalProposed,
      positionedTotal: totalPositioned,
      receivedTotal: totalReceived,
      givenTotal: totalGiven,
      proposedByPeriod: totalByPeriod,
      receivedByPeriod: receivedByPeriod,
      weekendOrHoliday,
      proposedPercent,
      positionedPercent,
      receivedPercent,
      balance: totalReceived - totalGiven
    };
  }, [statsData]);

  // Fonction de tri
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Si on clique sur la même colonne, inverser la direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Si on clique sur une nouvelle colonne, la trier par ordre croissant
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Filtrage et tri des données
  const filteredData = useMemo(() => {
    if (!statsData?.length) return [];

    let filtered = statsData.filter(user => {
      // Filtrer par utilisateur
      if (filter.userId !== 'all' && user.id !== filter.userId) {
        return false;
      }
      
      // Les autres filtres seraient appliqués ici de manière similaire
      return true;
    });

    // Appliquer le tri
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'proposedTotal':
          aValue = a.proposedTotal;
          bValue = b.proposedTotal;
          break;
        case 'positionedTotal':
          aValue = a.positionedTotal;
          bValue = b.positionedTotal;
          break;
        case 'receivedTotal':
          aValue = a.receivedTotal;
          bValue = b.receivedTotal;
          break;
        case 'balance':
          aValue = a.balance;
          bValue = b.balance;
          break;
        case 'weekendOrHoliday':
          aValue = a.weekendOrHoliday;
          bValue = b.weekendOrHoliday;
          break;
        default:
          aValue = a.name;
          bValue = b.name;
      }

      if (sortColumn === 'name') {
        // Pour les noms, tri alphabétique
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        // Pour les nombres, tri numérique
        return sortDirection === 'asc' 
          ? aValue - bValue
          : bValue - aValue;
      }
    });

    return filtered;
  }, [statsData, filter, sortColumn, sortDirection]);

  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
      <Toast 
        message={toast.message}
        isVisible={toast.visible}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, visible: false }))}
      />

      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Statistiques de la Bourse aux Gardes</h2>
          
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                  viewMode === 'table' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Tableau
              </button>
              <button
                onClick={() => setViewMode('chart')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                  viewMode === 'chart' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Graphiques
              </button>
            </div>
            
            <div className="relative">
              <select
                value={filter.userId}
                onChange={e => setFilter(prev => ({ ...prev, userId: e.target.value }))}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="all">Tous les utilisateurs</option>
                {users.filter(u => u.roles.isUser).map(user => (
                  <option key={user.id} value={user.id}>
                    {user.lastName} {user.firstName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  scope="col" 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center">
                    Utilisateur
                    {sortColumn === 'name' && (
                      sortDirection === 'asc' ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('proposedTotal')}
                >
                  <div className="flex items-center justify-center">
                    Gardes proposées
                    {sortColumn === 'proposedTotal' && (
                      sortDirection === 'asc' ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('positionedTotal')}
                >
                  <div className="flex items-center justify-center">
                    S'est positionné
                    {sortColumn === 'positionedTotal' && (
                      sortDirection === 'asc' ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('receivedTotal')}
                >
                  <div className="flex items-center justify-center">
                    Gardes reçues
                    {sortColumn === 'receivedTotal' && (
                      sortDirection === 'asc' ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('balance')}
                >
                  <div className="flex items-center justify-center">
                    Équilibre
                    {sortColumn === 'balance' && (
                      sortDirection === 'asc' ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('weekendOrHoliday')}
                >
                  <div className="flex items-center justify-center">
                    Week-end/Fériés
                    {sortColumn === 'weekendOrHoliday' && (
                      sortDirection === 'asc' ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{user.name}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-sm font-medium text-gray-900">{user.proposedTotal}</span>
                      <div className="flex items-center gap-1 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${PERIOD_COLORS.M}`}>{user.proposedByPeriod.M}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${PERIOD_COLORS.AM}`}>{user.proposedByPeriod.AM}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${PERIOD_COLORS.S}`}>{user.proposedByPeriod.S}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <div className="text-sm font-medium text-gray-900">{user.positionedTotal}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-sm font-medium text-gray-900">{user.receivedTotal}</span>
                      {user.positionedTotal > 0 && (
                        <span className="text-xs text-gray-500">
                          ({calculateSuccessRate(user.receivedTotal, user.positionedTotal)}%)
                        </span>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${PERIOD_COLORS.M}`}>{user.receivedByPeriod.M}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${PERIOD_COLORS.AM}`}>{user.receivedByPeriod.AM}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${PERIOD_COLORS.S}`}>{user.receivedByPeriod.S}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.balance > 0 
                        ? 'bg-green-100 text-green-800' 
                        : user.balance < 0 
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                    }`}>
                      <ArrowDownUp className={`h-3 w-3 mr-1 ${
                        user.balance > 0 
                          ? 'text-green-600' 
                          : user.balance < 0 
                            ? 'text-red-600'
                            : 'text-gray-600'
                      }`} />
                      {user.balance > 0 ? `+${user.balance}` : user.balance}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <div className="text-sm font-medium text-gray-900">{user.weekendOrHoliday}</div>
                  </td>
                </tr>
              ))}
              
              {/* Ligne de total */}
              {totalStats && (
                <tr className="bg-gray-50 font-medium">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                    TOTAL
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-sm font-bold text-gray-900">{totalStats.proposedTotal}</span>
                      <div className="flex items-center gap-1 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${PERIOD_COLORS.M}`}>{totalStats.proposedByPeriod.M}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${PERIOD_COLORS.AM}`}>{totalStats.proposedByPeriod.AM}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${PERIOD_COLORS.S}`}>{totalStats.proposedByPeriod.S}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <div className="text-sm font-bold text-gray-900">{totalStats.positionedTotal}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-sm font-bold text-gray-900">{totalStats.receivedTotal}</span>
                      {totalStats.positionedTotal > 0 && (
                        <span className="text-xs text-gray-500">
                          ({calculateSuccessRate(totalStats.receivedTotal, totalStats.positionedTotal)}%)
                        </span>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${PERIOD_COLORS.M}`}>{totalStats.receivedByPeriod.M}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${PERIOD_COLORS.AM}`}>{totalStats.receivedByPeriod.AM}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${PERIOD_COLORS.S}`}>{totalStats.receivedByPeriod.S}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      totalStats.balance === 0 
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {totalStats.balance}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <div className="text-sm font-bold text-gray-900">{totalStats.weekendOrHoliday}</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Simple Bar Chart (horizontal) */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Répartition des gardes par période</h3>
            
            {/* Matin */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500">Matin</span>
                <span className="text-xs font-medium text-gray-900">
                  {totalStats?.proposedByPeriod.M || 0} proposées / {totalStats?.receivedByPeriod.M || 0} reçues
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-amber-500 h-2.5 rounded-full" 
                    style={{ width: `${totalStats?.proposedTotal ? (totalStats.proposedByPeriod.M / totalStats.proposedTotal) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
            
            {/* Après-midi */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500">Après-midi</span>
                <span className="text-xs font-medium text-gray-900">
                  {totalStats?.proposedByPeriod.AM || 0} proposées / {totalStats?.receivedByPeriod.AM || 0} reçues
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-sky-500 h-2.5 rounded-full" 
                    style={{ width: `${totalStats?.proposedTotal ? (totalStats.proposedByPeriod.AM / totalStats.proposedTotal) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
            
            {/* Soir */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500">Soir</span>
                <span className="text-xs font-medium text-gray-900">
                  {totalStats?.proposedByPeriod.S || 0} proposées / {totalStats?.receivedByPeriod.S || 0} reçues
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-violet-500 h-2.5 rounded-full" 
                    style={{ width: `${totalStats?.proposedTotal ? (totalStats.proposedByPeriod.S / totalStats.proposedTotal) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
          
          {/* User Activity Comparison */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Activité des utilisateurs</h3>
            
            <div className="space-y-3">
              {filteredData
                .sort((a, b) => (b.proposedTotal + b.positionedTotal) - (a.proposedTotal + a.positionedTotal))
                .slice(0, 5)
                .map(user => (
                  <div key={user.id} className="bg-gray-50 p-2 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-gray-900">{user.name}</span>
                      <span className="text-xs text-gray-500">
                        {user.proposedTotal + user.positionedTotal + user.receivedTotal} actions
                      </span>
                    </div>
                    <div className="flex gap-1 h-2">
                      <div 
                        className="bg-blue-500 h-full rounded-l"
                        style={{ width: `${user.proposedPercent}%` }}
                        title={`Proposées: ${user.proposedTotal} (${user.proposedPercent}%)`}
                      ></div>
                      <div 
                        className="bg-green-500 h-full"
                        style={{ width: `${user.positionedPercent}%` }}
                        title={`Positionné: ${user.positionedTotal} (${user.positionedPercent}%)`}
                      ></div>
                      <div 
                        className="bg-purple-500 h-full rounded-r"
                        style={{ width: `${user.receivedPercent}%` }}
                        title={`Reçues: ${user.receivedTotal} (${user.receivedPercent}%)`}
                      ></div>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-blue-600">{user.proposedTotal} prop.</span>
                      <span className="text-[10px] text-green-600">{user.positionedTotal} pos.</span>
                      <span className="text-[10px] text-purple-600">{user.receivedTotal} reç.</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Legend */}
          <div className="col-span-full">
            <div className="flex flex-wrap gap-4 items-center justify-center p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span className="text-xs text-gray-700">Gardes proposées</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span className="text-xs text-gray-700">S'est positionné</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded"></div>
                <span className="text-xs text-gray-700">Gardes reçues</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-amber-500 rounded"></div>
                <span className="text-xs text-gray-700">Matin</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-sky-500 rounded"></div>
                <span className="text-xs text-gray-700">Après-midi</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-violet-500 rounded"></div>
                <span className="text-xs text-gray-700">Soir</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BagStatsViz;
