import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import { ChevronUp } from 'lucide-react';
import type { DoctorStats } from '../../types';
import type { User } from '../../../../features/users/types';

interface DoctorDesiderataChartProps {
  doctorStats: DoctorStats[];
  periodInfo?: {
    startDate: Date;
    endDate: Date;
    totalDays: number;
    totalCells: number;
  } | null;
  users?: User[];
}

interface ChartData {
  name: string;
  primaire: number;
  secondaire: number;
  total: number;
  userId: string;
  percentage: number;
  userStatus?: {
    isManager?: boolean;
    isPartTime?: boolean;
    isCAT?: boolean;
    isReplacement?: boolean;
  };
}


const DoctorDesiderataChart: React.FC<DoctorDesiderataChartProps> = ({ doctorStats, periodInfo, users = [] }) => {
  const [expandedDoctor, setExpandedDoctor] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'total' | 'primary' | 'secondary'>('total');

  // Préparer et trier les données
  const chartData = useMemo(() => {
    const totalCells = periodInfo?.totalCells || 1;
    
    const data: ChartData[] = doctorStats
      .filter(doctor => {
        // Filtrer les remplaçants
        const user = users.find(u => u.id === doctor.userId);
        return !user?.roles?.isReplacement;
      })
      .map(doctor => {
        // Trouver l'utilisateur correspondant pour récupérer ses statuts
        const user = users.find(u => u.id === doctor.userId);
        const percentage = (doctor.totalDesiderata / totalCells) * 100;
        
        return {
          name: doctor.name,
          primaire: doctor.primaryCount,
          secondaire: doctor.secondaryCount,
          total: doctor.totalDesiderata,
          userId: doctor.userId,
          percentage: Math.round(percentage * 10) / 10, // Arrondir à 1 décimale
          userStatus: user?.roles ? {
            isManager: user.roles.isManager,
            isPartTime: user.roles.isPartTime,
            isCAT: user.roles.isCAT,
            isReplacement: user.roles.isReplacement
          } : undefined
        };
      });

    // Trier selon le critère sélectionné
    return data.sort((a, b) => {
      switch (sortBy) {
        case 'primary':
          return b.primaire - a.primaire;
        case 'secondary':
          return b.secondaire - a.secondaire;
        default:
          return b.total - a.total;
      }
    });
  }, [doctorStats, sortBy, periodInfo, users]);
  
  // Composant personnalisé pour l'axe X avec couleurs selon le statut
  const CustomAxisTick = (props: any) => {
    const { x, y, payload } = props;
    const userData = chartData.find(d => d.name === payload.value);
    
    let color = 'text-gray-700';
    if (userData?.userStatus) {
      if (userData.userStatus.isManager) color = 'text-purple-700';
      else if (userData.userStatus.isPartTime) color = 'text-orange-700';
      else if (userData.userStatus.isCAT) color = 'text-green-700';
    }
    
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={16}
          textAnchor="end"
          className={`text-xs ${color} fill-current`}
          transform="rotate(-45)"
        >
          {payload.value}
        </text>
      </g>
    );
  };

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartData; color: string; name: string; value: number }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const primaryPercentage = data.total > 0 ? Math.round((data.primaire / data.total) * 100) : 0;
      const secondaryPercentage = data.total > 0 ? Math.round((data.secondaire / data.total) * 100) : 0;
      
      return (
        <div className="bg-white p-3 rounded shadow-lg border border-gray-200">
          <p className="font-medium text-sm mb-2">{data.name}</p>
          <div className="space-y-1">
            <p className="text-xs">
              <span className="inline-block w-20">Primaires:</span>
              <span className="font-semibold text-indigo-600">{data.primaire}</span>
              <span className="text-gray-500 ml-1">({primaryPercentage}%)</span>
            </p>
            <p className="text-xs">
              <span className="inline-block w-20">Secondaires:</span>
              <span className="font-semibold text-purple-600">{data.secondaire}</span>
              <span className="text-gray-500 ml-1">({secondaryPercentage}%)</span>
            </p>
            <p className="text-xs border-t pt-1">
              <span className="inline-block w-20">Total:</span>
              <span className="font-semibold">{data.total}</span>
            </p>
            <p className="text-xs">
              <span className="inline-block w-20">% période:</span>
              <span className="font-semibold text-gray-900">{data.percentage}%</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const handleBarClick = (data: ChartData) => {
    setExpandedDoctor(expandedDoctor === data.userId ? null : data.userId);
  };

  const expandedDetails = useMemo(() => {
    if (!expandedDoctor) return null;
    const doctor = doctorStats.find(d => d.userId === expandedDoctor);
    if (!doctor) return null;
    
    return {
      userId: doctor.userId,
      details: {
        weekends: doctor.weekendCount,
        holidays: doctor.holidayCount,
        averagePerMonth: doctor.averagePerMonth
      }
    };
  }, [expandedDoctor, doctorStats]);

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            Desiderata par médecin
          </h3>
          {periodInfo && (
            <p className="text-sm text-gray-600 mt-1">
              Période : {periodInfo.totalDays} jours × 3 créneaux = {periodInfo.totalCells} cellules
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 mr-2">Trier par:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'total' | 'primary' | 'secondary')}
            className="text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="total">Total</option>
            <option value="primary">Primaires</option>
            <option value="secondary">Secondaires</option>
          </select>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <BarChart 
          data={chartData} 
          margin={{ top: 20, right: 30, left: 40, bottom: 80 }}
          onClick={(e) => e && e.activePayload && handleBarClick(e.activePayload[0].payload)}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="name" 
            angle={-45}
            textAnchor="end"
            height={100}
            tick={<CustomAxisTick />}
          />
          <YAxis 
            label={{ value: 'Nombre de desiderata', angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 12 }}
            domain={[0, periodInfo?.totalCells || 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar 
            dataKey="primaire" 
            stackId="a"
            fill="#6366f1" 
            name="Primaires"
            cursor="pointer"
          />
          <Bar 
            dataKey="secondaire" 
            stackId="a"
            fill="#a78bfa" 
            name="Secondaires"
            cursor="pointer"
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Détails étendus */}
      {expandedDetails && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">
              Détails pour {chartData.find(d => d.userId === expandedDetails.userId)?.name}
            </h4>
            <button
              onClick={() => setExpandedDoctor(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              <ChevronUp className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-3 rounded border border-gray-200">
              <p className="text-sm text-gray-600">Weekends</p>
              <p className="text-xl font-semibold text-gray-900">{expandedDetails.details.weekends}</p>
            </div>
            <div className="bg-white p-3 rounded border border-gray-200">
              <p className="text-sm text-gray-600">Jours fériés</p>
              <p className="text-xl font-semibold text-gray-900">{expandedDetails.details.holidays}</p>
            </div>
            <div className="bg-white p-3 rounded border border-gray-200">
              <p className="text-sm text-gray-600">Moyenne/mois</p>
              <p className="text-xl font-semibold text-gray-900">{expandedDetails.details.averagePerMonth}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        <div className="text-xs text-gray-500 text-center">
          Cliquez sur une barre pour voir plus de détails
        </div>
        
        {/* Légende des couleurs de statut */}
        <div className="flex flex-wrap justify-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <span className="font-medium text-purple-700">Gérant</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium text-orange-700">Mi-temps</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium text-green-700">CAT</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium text-gray-700">Temps plein</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorDesiderataChart;