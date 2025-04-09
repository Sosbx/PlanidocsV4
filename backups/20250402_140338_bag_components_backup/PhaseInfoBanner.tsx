import React from 'react';
import { Info, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import type { BagPhaseConfig } from '../../types/planning';

interface PhaseInfoBannerProps {
  bagPhaseConfig: BagPhaseConfig;
  className?: string;
}

/**
 * Composant qui affiche une bannière d'information adaptée à la phase actuelle de la bourse aux gardes
 */
const PhaseInfoBanner: React.FC<PhaseInfoBannerProps> = ({ bagPhaseConfig, className = '' }) => {
  // Si la phase n'est pas configurée, ne rien afficher
  if (!bagPhaseConfig.isConfigured) {
    return null;
  }

  // Déterminer le style et le contenu en fonction de la phase
  let icon = <Info className="h-4 w-4" />;
  let bgColor = 'bg-blue-50';
  let textColor = 'text-blue-700';
  let borderColor = 'border-blue-200';
  let title = '';
  let message = '';

  switch (bagPhaseConfig.phase) {
    case 'submission':
      icon = <Clock className="h-4 w-4" />;
      bgColor = 'bg-blue-50';
      textColor = 'text-blue-700';
      borderColor = 'border-blue-200';
      title = 'Phase de soumission';
      message = 'Vous pouvez proposer vos gardes à l\'échange et vous positionner sur les gardes disponibles.';
      break;
    
    case 'distribution':
      icon = <AlertTriangle className="h-4 w-4" />;
      bgColor = 'bg-yellow-50';
      textColor = 'text-yellow-700';
      borderColor = 'border-yellow-200';
      title = 'Phase de distribution';
      message = 'L\'administrateur est en train de valider les échanges. Vous ne pouvez plus proposer de gardes ni vous positionner.';
      break;
    
    case 'completed':
      icon = <CheckCircle className="h-4 w-4" />;
      bgColor = 'bg-amber-50';
      textColor = 'text-amber-700';
      borderColor = 'border-amber-200';
      title = 'Phase terminée';
      message = 'Les gardes affichées sont celles qui n\'ont pas trouvé preneur. Vous pouvez soit les proposer aux remplaçants, soit les garder pour vous.';
      break;
  }

  return (
    <div className={`${bgColor} ${textColor} ${borderColor} border rounded-md p-3 mb-4 ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0 mt-0.5">
          {icon}
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium">{title}</h3>
          <div className="mt-1 text-xs">
            {message}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhaseInfoBanner;
