import React, { useMemo, useState } from 'react';
import { createParisDate } from '@/utils/timezoneUtils';
import { FileText, TrendingUp, TrendingDown } from 'lucide-react';
import type { User } from '../../../../types/users';
import type { GeneratedPlanning } from '../../../../types/planning';
import { useToast } from '../../../../hooks/useToast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ShiftTypeStatisticsTableProps {
  users: User[];
  plannings: Record<string, Record<string, GeneratedPlanning>>;
  startDate: Date;
  endDate: Date;
  associationId: string;
}

// Liste ordonnée des types de postes (groupés par période puis par ordre alphabétique)
const SHIFT_TYPES_BY_PERIOD = {
  'Matin': ['CM', 'HM', 'MC', 'ML', 'MM', 'RM', 'SM'],
  'Après-midi': ['AC', 'AL', 'CA', 'CT', 'HA', 'NA', 'RA', 'SA'],
  'Soir': ['CS', 'HS', 'NC', 'NL', 'NM', 'NR', 'NZ', 'RS', 'SS']
};

// Liste plate de tous les types de postes dans l'ordre
const ALL_SHIFT_TYPES = Object.values(SHIFT_TYPES_BY_PERIOD).flat();

// Couleurs pour les périodes (cohérent avec ThemeColors.css)
const PERIOD_COLORS = {
  'Matin': 'bg-[#E6F0FA]',
  'Après-midi': 'bg-[#EEF2FF]',
  'Soir': 'bg-[#EEE8FF]'
};

// Couleurs pour les statuts des médecins (cohérent avec UsersList.tsx)
const STATUS_COLORS = {
  'fullTime': 'text-blue-800',      // Associé plein temps
  'partTime': 'text-orange-800',    // Associé mi-temps
  'cat': 'text-green-800',          // CAT
  'replacement': 'text-amber-800',  // Remplaçant
  'other': 'text-gray-700'          // Autres
};

interface ShiftTypeStats {
  userId: string;
  userName: string;
  userStatus: 'fullTime' | 'partTime' | 'cat' | 'replacement' | 'other';
  statusLabel: string;
  shiftCounts: Record<string, number>;
  totalShifts: number;
  periodBreakdown: {
    morning: number;
    afternoon: number;
    evening: number;
  };
}

const ShiftTypeStatisticsTable: React.FC<ShiftTypeStatisticsTableProps> = ({
  users,
  plannings,
  startDate,
  endDate,
  associationId
}) => {
  const { showToast } = useToast();
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Calculer les statistiques
  const statistics = useMemo(() => {
    const userStatsMap: Record<string, ShiftTypeStats> = {};
    const shiftTypeTotals: Record<string, number> = {};
    let overallTotal = 0;

    // Initialiser les compteurs
    users.forEach(user => {
      // Déterminer le statut de l'utilisateur
      let userStatus: 'fullTime' | 'partTime' | 'cat' | 'replacement' | 'other' = 'other';
      let statusLabel = 'Autre';
      
      if (user.roles?.isReplacement) {
        userStatus = 'replacement';
        statusLabel = 'Remplaçant';
      } else if (user.roles?.isCAT) {
        userStatus = 'cat';
        statusLabel = 'CAT';
      } else if (user.roles?.isPartTime) {
        userStatus = 'partTime';
        statusLabel = 'Associé mi-temps';
      } else if (user.roles?.isUser && !user.roles?.isPartTime && !user.roles?.isCAT) {
        userStatus = 'fullTime';
        statusLabel = 'Associé plein temps';
      }
      
      userStatsMap[user.id] = {
        userId: user.id,
        userName: `${user.lastName} ${user.firstName}`,
        userStatus,
        statusLabel,
        shiftCounts: {},
        totalShifts: 0,
        periodBreakdown: {
          morning: 0,
          afternoon: 0,
          evening: 0
        }
      };
    });

    ALL_SHIFT_TYPES.forEach(type => {
      shiftTypeTotals[type] = 0;
    });

    // Parcourir tous les plannings
    Object.entries(plannings).forEach(([periodId, periodPlannings]) => {
      Object.entries(periodPlannings).forEach(([userId, userPlanning]) => {
        if (!userStatsMap[userId] || !userPlanning.assignments) return;

        Object.entries(userPlanning.assignments).forEach(([key, assignment]) => {
          if (!assignment || !assignment.date || !assignment.shiftType) return;

          // Vérifier si l'assignment est dans la période sélectionnée
          const assignmentDate = new Date(assignment.date);
          if (assignmentDate < startDate || assignmentDate > endDate) return;

          const shiftType = assignment.shiftType;

          // Incrémenter les compteurs
          if (!userStatsMap[userId].shiftCounts[shiftType]) {
            userStatsMap[userId].shiftCounts[shiftType] = 0;
          }
          userStatsMap[userId].shiftCounts[shiftType]++;
          userStatsMap[userId].totalShifts++;
          shiftTypeTotals[shiftType] = (shiftTypeTotals[shiftType] || 0) + 1;
          overallTotal++;

          // Mettre à jour le breakdown par période
          if (SHIFT_TYPES_BY_PERIOD.Matin.includes(shiftType)) {
            userStatsMap[userId].periodBreakdown.morning++;
          } else if (SHIFT_TYPES_BY_PERIOD['Après-midi'].includes(shiftType)) {
            userStatsMap[userId].periodBreakdown.afternoon++;
          } else if (SHIFT_TYPES_BY_PERIOD.Soir.includes(shiftType)) {
            userStatsMap[userId].periodBreakdown.evening++;
          }
        });
      });
    });

    // Convertir en tableau
    let userStats = Object.values(userStatsMap);

    // Trier les données - d'abord par statut, puis par nom
    userStats.sort((a, b) => {
      // Ordre des statuts
      const statusOrder = ['fullTime', 'partTime', 'cat', 'replacement', 'other'];
      const statusCompare = statusOrder.indexOf(a.userStatus) - statusOrder.indexOf(b.userStatus);
      
      if (statusCompare !== 0) {
        return statusCompare;
      }
      
      // Si même statut, trier par nom alphabétique
      return a.userName.localeCompare(b.userName);
    });
    
    // Appliquer le tri par colonne si spécifié
    if (sortColumn) {
      userStats.sort((a, b) => {
        // D'abord par statut
        const statusOrder = ['fullTime', 'partTime', 'cat', 'replacement', 'other'];
        const statusCompare = statusOrder.indexOf(a.userStatus) - statusOrder.indexOf(b.userStatus);
        
        if (statusCompare !== 0) {
          return statusCompare;
        }
        
        // Ensuite par la colonne sélectionnée
        let aValue: number;
        let bValue: number;

        if (sortColumn === 'total') {
          aValue = a.totalShifts;
          bValue = b.totalShifts;
        } else if (sortColumn === 'name') {
          return sortDirection === 'asc' 
            ? a.userName.localeCompare(b.userName)
            : b.userName.localeCompare(a.userName);
        } else {
          aValue = a.shiftCounts[sortColumn] || 0;
          bValue = b.shiftCounts[sortColumn] || 0;
        }

        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      });
    }

    return {
      userStats,
      shiftTypeTotals,
      overallTotal
    };
  }, [users, plannings, startDate, endDate, sortColumn, sortDirection]);

  // Gérer le tri
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Exporter en PDF
  const exportToPDF = () => {
    try {
      const doc = new jsPDF('landscape', 'mm', 'a4');
      
      // Titre
      doc.setFontSize(16);
      doc.text('Répartition par type de poste', 14, 15);
      
      // Période
      doc.setFontSize(10);
      doc.text(`Période: ${startDate.toLocaleDateString('fr-FR')} - ${endDate.toLocaleDateString('fr-FR')}`, 14, 22);
      
      // Préparer les données pour la table
      const headers = [['Médecin', ...ALL_SHIFT_TYPES, 'Total']];
      const data: any[] = [];
      
      let currentStatus = '';
      statistics.userStats.forEach(stat => {
        // Ajouter une ligne de séparation pour le statut si nécessaire
        if (stat.statusLabel !== currentStatus) {
          currentStatus = stat.statusLabel;
          data.push([{
            content: currentStatus,
            colSpan: ALL_SHIFT_TYPES.length + 2,
            styles: { 
              fillColor: [240, 240, 240],
              fontStyle: 'bold',
              fontSize: 10
            }
          }]);
        }
        
        // Ligne de données
        const row = [stat.userName];
        ALL_SHIFT_TYPES.forEach(type => {
          row.push((stat.shiftCounts[type] || 0).toString());
        });
        row.push(stat.totalShifts.toString());
        data.push(row);
      });
      
      // Ligne des totaux
      const totalsRow = ['TOTAL'];
      ALL_SHIFT_TYPES.forEach(type => {
        totalsRow.push((statistics.shiftTypeTotals[type] || 0).toString());
      });
      totalsRow.push(statistics.overallTotal.toString());
      data.push(totalsRow);
      
      // Générer la table
      autoTable(doc, {
        head: headers,
        body: data,
        startY: 28,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 2
        },
        headStyles: {
          fillColor: [66, 133, 244],
          textColor: 255,
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 40 }, // Colonne médecin plus large
          ...Object.fromEntries(
            [...Array(ALL_SHIFT_TYPES.length + 1)].map((_, i) => [i + 1, { cellWidth: 'auto', halign: 'center' }])
          )
        },
        didParseCell: function(data) {
          // Style pour la ligne des totaux
          if (data.row.index === data.table.body.length - 1) {
            data.cell.styles.fillColor = [220, 220, 220];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });
      
      // Sauvegarder le PDF
      const fileName = `repartition_postes_${createParisDate().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      showToast('Répartition exportée avec succès', 'success');
    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error);
      showToast('Erreur lors de l\'export de la répartition', 'error');
    }
  };


  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      <div className="p-4 border-b">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold">Répartition par type de poste</h3>
            <p className="text-sm text-gray-600 mt-1">
              Distribution des postes par médecin après échanges du {startDate.toLocaleDateString('fr-FR')} au {endDate.toLocaleDateString('fr-FR')}
            </p>
          </div>
          <button
            onClick={exportToPDF}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <FileText className="h-4 w-4 mr-1.5" />
            Exporter PDF
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  Médecin
                  {sortColumn === 'name' && (
                    sortDirection === 'asc' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />
                  )}
                </div>
              </th>
              {Object.entries(SHIFT_TYPES_BY_PERIOD).map(([period, types]) => (
                <React.Fragment key={period}>
                  {types.map(type => (
                    <th
                      key={type}
                      className={`px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 ${PERIOD_COLORS[period as keyof typeof PERIOD_COLORS]}`}
                      onClick={() => handleSort(type)}
                    >
                      <div className="flex items-center justify-center gap-1">
                        {type}
                        {sortColumn === type && (
                          sortDirection === 'asc' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />
                        )}
                      </div>
                    </th>
                  ))}
                </React.Fragment>
              ))}
              <th
                className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 bg-gray-100"
                onClick={() => handleSort('total')}
              >
                <div className="flex items-center justify-center gap-1">
                  Total
                  {sortColumn === 'total' && (
                    sortDirection === 'asc' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {statistics.userStats.map((stat, index) => {
              // Ajouter une ligne de séparation entre les différents statuts
              const prevStat = index > 0 ? statistics.userStats[index - 1] : null;
              const showStatusSeparator = prevStat && prevStat.userStatus !== stat.userStatus;
              
              return (
                <React.Fragment key={stat.userId}>
                  {showStatusSeparator && (
                    <tr className="bg-gray-50">
                      <td colSpan={ALL_SHIFT_TYPES.length + 2} className="px-4 py-1 text-xs font-semibold text-gray-600">
                        {stat.statusLabel}
                      </td>
                    </tr>
                  )}
                  {index === 0 && (
                    <tr className="bg-gray-50">
                      <td colSpan={ALL_SHIFT_TYPES.length + 2} className="px-4 py-1 text-xs font-semibold text-gray-600">
                        {stat.statusLabel}
                      </td>
                    </tr>
                  )}
                  <tr className="hover:bg-gray-50">
                    <td className={`sticky left-0 z-10 bg-white px-4 py-2 whitespace-nowrap text-sm font-medium ${STATUS_COLORS[stat.userStatus]}`}>
                      {stat.userName}
                    </td>
                    {ALL_SHIFT_TYPES.map(type => {
                      const count = stat.shiftCounts[type] || 0;
                      return (
                        <td
                          key={type}
                          className="px-2 py-2 text-center text-sm text-gray-700"
                        >
                          {count || '-'}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2 text-center text-sm font-semibold text-gray-900">
                      {stat.totalShifts}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
            {/* Ligne des totaux */}
            <tr className="bg-gray-100 font-semibold">
              <td className="sticky left-0 z-10 bg-gray-100 px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                TOTAL
              </td>
              {ALL_SHIFT_TYPES.map(type => (
                <td key={type} className="px-2 py-2 text-center text-sm">
                  {statistics.shiftTypeTotals[type] || 0}
                </td>
              ))}
              <td className="px-4 py-2 text-center text-sm">
                {statistics.overallTotal}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default ShiftTypeStatisticsTable;