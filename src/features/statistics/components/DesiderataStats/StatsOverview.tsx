import React from 'react';
import { Users, Calendar, TrendingUp, AlertTriangle } from 'lucide-react';
import type { PeriodAnalysis } from '../../types';

interface StatsOverviewProps {
  analysis: PeriodAnalysis | null;
  loading?: boolean;
}

const StatsOverview: React.FC<StatsOverviewProps> = ({ analysis, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white p-6 rounded-lg shadow animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-8 bg-gray-300 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  const cards = [
    {
      title: 'Taux de participation',
      value: `${analysis.participationRate}%`,
      subtitle: `${Math.round(analysis.totalUsers * analysis.participationRate / 100)} / ${analysis.totalUsers} médecins`,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: 'Moyenne par médecin',
      value: analysis.averageDesiderataPerUser.toString(),
      subtitle: 'desiderata par médecin',
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: 'Jours critiques',
      value: analysis.criticalDays.length.toString(),
      subtitle: 'jours > 60% indisponibles',
      icon: AlertTriangle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    },
    {
      title: 'Période des fêtes',
      value: `${Math.max(
        analysis.holidayAnalysis.christmas.percentage,
        analysis.holidayAnalysis.newYear.percentage
      )}%`,
      subtitle: 'indisponibilité max',
      icon: Calendar,
      color: 'text-red-600',
      bgColor: 'bg-red-100'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <div key={index} className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">{card.title}</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{card.value}</p>
              <p className="mt-1 text-xs text-gray-500">{card.subtitle}</p>
            </div>
            <div className={`${card.bgColor} p-3 rounded-full`}>
              <card.icon className={`h-6 w-6 ${card.color}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsOverview;