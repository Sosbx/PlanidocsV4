import React from 'react';
import { AlertCircle, CheckCircle, Info, Target, TrendingUp, Users } from 'lucide-react';
import type { SuggestionScore } from '../../types/scoring';

interface SuggestionIndicatorProps {
  suggestion: SuggestionScore;
  userName?: string;
  isCompact?: boolean;
}

const SuggestionIndicator: React.FC<SuggestionIndicatorProps> = ({
  suggestion,
  userName,
  isCompact = false
}) => {
  const getScoreIcon = () => {
    if (suggestion.score >= 70) return <CheckCircle className="h-4 w-4" />;
    if (suggestion.score >= 40) return <AlertCircle className="h-4 w-4" />;
    return <Info className="h-4 w-4" />;
  };

  const getColorClasses = () => {
    switch (suggestion.color) {
      case 'green':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-700',
          icon: 'text-green-500'
        };
      case 'orange':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          text: 'text-orange-700',
          icon: 'text-orange-500'
        };
      case 'red':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-700',
          icon: 'text-red-500'
        };
    }
  };

  const colors = getColorClasses();

  if (isCompact) {
    return (
      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} ${colors.border} border`}>
        <span className={colors.icon}>{getScoreIcon()}</span>
        <span className="ml-1">{suggestion.score}</span>
      </div>
    );
  }

  return (
    <div className={`p-3 rounded-lg ${colors.bg} ${colors.border} border`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={colors.icon}>{getScoreIcon()}</span>
          <span className={`font-semibold ${colors.text}`}>
            Score: {suggestion.score}/100
          </span>
        </div>
        {userName && (
          <span className="text-sm text-gray-600">{userName}</span>
        )}
      </div>

      {/* Recommandation */}
      <p className={`text-sm ${colors.text} mb-2`}>{suggestion.recommendation}</p>

      {/* Détails des composants */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1">
          <Target className="h-3 w-3 text-gray-400" />
          <span className="text-gray-600">
            Déficit: <span className="font-medium">{suggestion.components.satisfactionDeficit}%</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Users className="h-3 w-3 text-gray-400" />
          <span className="text-gray-600">
            Priorité: <span className="font-medium">{suggestion.components.demandPriority}%</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-gray-400" />
          <span className="text-gray-600">
            Équité: <span className="font-medium">{suggestion.components.equityScore}%</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Info className="h-3 w-3 text-gray-400" />
          <span className="text-gray-600">
            Valeur: <span className="font-medium">{suggestion.components.shiftValue}%</span>
          </span>
        </div>
      </div>

      {/* Impact */}
      <div className="mt-2 pt-2 border-t border-gray-200">
        <div className="text-xs text-gray-600">
          <div>
            Taux après attribution: 
            <span className="font-medium ml-1">
              {Math.round(suggestion.impact.newSatisfactionRate * 100)}%
            </span>
            <span className={`ml-1 ${suggestion.impact.satisfactionDelta > 0 ? 'text-green-600' : ''}`}>
              (+{Math.round(suggestion.impact.satisfactionDelta * 100)}%)
            </span>
          </div>
          {suggestion.impact.remainingDeficit > 0 && (
            <div className="text-orange-600">
              Déficit restant: {Math.round(suggestion.impact.remainingDeficit * 100)}%
            </div>
          )}
        </div>
      </div>

      {/* Statistiques utilisateur */}
      <div className="mt-2 pt-2 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          <div>Demandes: {suggestion.stats.requestedShifts}</div>
          <div>Reçues: {suggestion.stats.receivedShifts}</div>
          <div>Taux actuel: {Math.round(suggestion.stats.satisfactionRate * 100)}%</div>
        </div>
      </div>
    </div>
  );
};

export default SuggestionIndicator;