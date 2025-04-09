import React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, Percent, Clock } from 'lucide-react';
import { PlanningConfig } from '../types/planning';

interface ConfigurationDisplayProps {
  config: PlanningConfig;
  className?: string;
}

const ConfigurationDisplay: React.FC<ConfigurationDisplayProps> = ({ config, className = '' }) => {
  if (!config.isConfigured) {
    return (
      <div className={`bg-yellow-50 p-4 rounded-md ${className}`}>
        <p className="text-yellow-700">Le planning n'est pas encore configuré.</p>
      </div>
    );
  }

  return (
    <div className={`bg-white p-4 rounded-md shadow-sm ${className}`}>
      <h3 className="text-lg font-medium text-gray-900 mb-4">Configuration Actuelle</h3>
      
      <div className="space-y-3">
        <div className="flex items-center">
          <Calendar className="h-5 w-5 text-indigo-500 mr-2" />
          <div>
            <p className="text-sm text-gray-600">Période</p>
            <p className="text-sm font-medium">
              Du {format(config.startDate, 'd MMMM yyyy', { locale: fr })} au{' '}
              {format(config.endDate, 'd MMMM yyyy', { locale: fr })}
            </p>
          </div>
        </div>

        <div className="flex items-center">
          <Clock className="h-5 w-5 text-indigo-500 mr-2" />
          <div>
            <p className="text-sm text-gray-600">Date limite de réponse</p>
            <p className="text-sm font-medium">
              {format(config.deadline, 'd MMMM yyyy à HH:mm', { locale: fr })}
            </p>
          </div>
        </div>

        <div className="flex items-center">
          <Percent className="h-5 w-5 text-indigo-500 mr-2" />
          <div>
            <p className="text-sm text-gray-600">Limites de desiderata</p>
            <p className="text-sm font-medium">
              Primaires: {config.primaryDesiderataLimit}% - 
              Secondaires: {config.secondaryDesiderataLimit}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigurationDisplay;