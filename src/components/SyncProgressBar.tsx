import React from 'react';
import type { SyncProgress } from '../types/googleCalendar';

interface SyncProgressBarProps {
  progress: SyncProgress;
}

export const SyncProgressBar: React.FC<SyncProgressBarProps> = ({ progress }) => {
  const percentage = Math.round((progress.current / progress.total) * 100);
  
  // Mapper les phases aux couleurs
  const getProgressColor = (phase: SyncProgress['phase']) => {
    switch (phase) {
      case 'analyzing':
        return 'bg-blue-500';
      case 'migrating':
        return 'bg-indigo-500';
      case 'creating':
        return 'bg-green-500';
      case 'updating':
        return 'bg-yellow-500';
      case 'deleting':
        return 'bg-red-500';
      case 'finalizing':
        return 'bg-purple-500';
      default:
        return 'bg-blue-500';
    }
  };
  
  const progressColor = getProgressColor(progress.phase);
  
  return (
    <div className="w-full animate-fade-in">
      <div className="flex justify-between items-center text-xs text-gray-600 mb-1">
        <span className="truncate mr-2">{progress.message}</span>
        <span className="font-medium">{percentage}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-300 ease-out ${progressColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};