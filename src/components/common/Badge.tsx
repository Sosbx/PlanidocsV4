import React from 'react';

export type BadgeType = 
  'exchange' | 'give' | 'replacement' | 'interested' | 'pending' | 'completed' | 'combined' |
  'exchange-replacement' | 'give-replacement' | 'combined-replacement' | 'operation-types';
export type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  type: BadgeType;
  count?: number;
  size?: BadgeSize;
  className?: string;
  operationTypes?: string[]; // Pour le type 'operation-types'
}

/**
 * Composant Badge réutilisable pour afficher des pastilles avec compteur
 * Utilisé pour indiquer le statut des gardes et le nombre d'utilisateurs intéressés
 */
const Badge: React.FC<BadgeProps> = ({ 
  type, 
  count, 
  size = 'md',
  className = '',
  operationTypes = []
}) => {
  // Déterminer les classes de style en fonction du type
  const getTypeClasses = () => {
    // Pour le type 'operation-types', utiliser des couleurs spécifiques selon les opérations
    if (type === 'operation-types') {
      const hasExchange = operationTypes.includes('exchange');
      const hasGive = operationTypes.includes('give');
      const hasReplacement = operationTypes.includes('replacement');
      
      // Utiliser les mêmes couleurs que dans DirectExchangeTable.tsx mais plus discrètes
      if (hasExchange && hasGive && hasReplacement) {
        return 'bg-amber-50 text-amber-700 border-amber-100 font-medium'; // CER
      } else if (hasExchange && hasGive) {
        return 'bg-orange-50 text-orange-700 border-orange-100 font-medium'; // CE
      } else if (hasExchange && hasReplacement) {
        return 'bg-lime-50 text-lime-700 border-lime-100 font-medium'; // ER
      } else if (hasGive && hasReplacement) {
        return 'bg-amber-50 text-amber-700 border-amber-100 font-medium'; // CR
      } else if (hasExchange) {
        return 'bg-green-50 text-green-700 border-green-100 font-medium'; // E
      } else if (hasGive) {
        return 'bg-yellow-50 text-yellow-700 border-yellow-100 font-medium'; // C
      } else if (hasReplacement) {
        return 'bg-amber-50 text-amber-700 border-amber-100 font-medium'; // R
      }
      
      // Couleur par défaut si aucune opération n'est spécifiée
      return 'bg-gray-50 text-gray-700 border-gray-100 font-medium';
    }
    
    // Pour les autres types, conserver les couleurs existantes
    switch (type) {
      case 'exchange':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'; // Jaune pour échange
      case 'give':
        return 'bg-blue-100 text-blue-800 border-blue-200'; // Bleu pour cession
      case 'combined':
        return 'bg-purple-100 text-purple-800 border-purple-200'; // Violet pour combiné
      case 'replacement':
        return 'bg-amber-100 text-amber-800 border-amber-200'; // Ambre pour remplaçant
      case 'exchange-replacement':
        return 'bg-orange-100 text-orange-800 border-orange-200'; // Orange pour échange + remplaçant
      case 'give-replacement':
        return 'bg-teal-100 text-teal-800 border-teal-200'; // Teal pour cession + remplaçant
      case 'combined-replacement':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200'; // Indigo pour combiné + remplaçant
      case 'interested':
        return 'bg-green-100 text-green-800 border-green-200'; // Vert pour intéressés
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Déterminer les classes de taille
  const getSizeClasses = () => {
    // Pour le type 'operation-types', utiliser des tailles plus petites
    if (type === 'operation-types') {
      switch (size) {
        case 'sm':
          return 'text-[7px] px-0.5 min-w-[12px] h-3';
        case 'lg':
          return 'text-[9px] px-1 min-w-[18px] h-5';
        case 'md':
        default:
          return 'text-[8px] px-0.5 min-w-[14px] h-4';
      }
    }
    
    // Pour les autres types, conserver les tailles existantes
    switch (size) {
      case 'sm':
        return 'text-[9px] px-1 min-w-[16px] h-4';
      case 'lg':
        return 'text-xs px-1.5 min-w-[22px] h-6';
      case 'md':
      default:
        return 'text-[10px] px-1 min-w-[18px] h-5';
    }
  };

  // Déterminer le texte à afficher
  const getDisplayText = () => {
    if (count !== undefined) {
      return count.toString();
    }
    
    switch (type) {
      case 'exchange':
        return 'E';
      case 'give':
        return 'C';
      case 'combined':
        return 'CE';
      case 'replacement':
        return 'R';
      case 'exchange-replacement':
        return 'ER';
      case 'give-replacement':
        return 'CR';
      case 'combined-replacement':
        return 'CER';
      case 'operation-types': {
        // Construire le texte en fonction des types d'opérations
        let text = '';
        if (operationTypes.includes('give')) text += 'C';
        if (operationTypes.includes('exchange')) text += 'E';
        if (operationTypes.includes('replacement')) text += 'R';
        return text || '-';
      }
      case 'pending':
        return 'P';
      case 'completed':
        return '✓';
      default:
        return '';
    }
  };

  return (
    <div 
      className={`
        inline-flex items-center justify-center 
        font-medium rounded-full border
        ${getTypeClasses()} 
        ${getSizeClasses()}
        ${className}
        ${type === 'operation-types' ? 'badge-operation-types-wrapper' : ''}
      `}
      title={
        type === 'exchange' ? 'Échange proposé' :
        type === 'give' ? 'Cession proposée' :
        type === 'combined' ? 'Échange et cession proposés' :
        type === 'replacement' ? 'Proposé aux remplaçants' :
        type === 'exchange-replacement' ? 'Échange et remplaçant proposés' :
        type === 'give-replacement' ? 'Cession et remplaçant proposés' :
        type === 'combined-replacement' ? 'Échange, cession et remplaçant proposés' :
        type === 'operation-types' ? (() => {
          const types = [];
          if (operationTypes.includes('exchange')) types.push('Échange');
          if (operationTypes.includes('give')) types.push('Cession');
          if (operationTypes.includes('replacement')) types.push('Remplaçant');
          return types.length > 0 ? `${types.join(', ')} proposé(s)` : 'Aucune option sélectionnée';
        })() :
        type === 'interested' ? `${count} utilisateur(s) intéressé(s)` :
        type === 'pending' ? 'En attente de validation' :
        type === 'completed' ? 'Échange finalisé' : ''
      }
    >
      {getDisplayText()}
    </div>
  );
};

export default Badge;
