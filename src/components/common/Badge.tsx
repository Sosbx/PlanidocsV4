import React from 'react';

export type BadgeType = 
  'exchange' | 'give' | 'replacement' | 'interested' | 'pending' | 'completed' | 'combined' |
  'exchange-replacement' | 'give-replacement' | 'combined-replacement' | 'operation-types';
export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';

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
      
      // Adapter les couleurs pour correspondre exactement aux couleurs des cellules
      if (hasExchange && hasGive && hasReplacement) {
        return 'bg-orange-100 text-orange-800 border-orange-200 font-bold'; // CER - même que CR et ER
      } else if (hasExchange && hasGive) {
        return 'bg-lime-100 text-lime-800 border-lime-200 font-bold'; // CE - teinte intermédiaire jaune-vert
      } else if (hasExchange && hasReplacement) {
        return 'bg-orange-100 text-orange-800 border-orange-200 font-bold'; // ER - même que CR et CER
      } else if (hasGive && hasReplacement) {
        return 'bg-orange-100 text-orange-800 border-orange-200 font-bold'; // CR - référence pour R
      } else if (hasExchange) {
        return 'bg-green-50 text-green-700 border-green-100 font-bold'; // E - vert très pâle
      } else if (hasGive) {
        return 'bg-yellow-100 text-yellow-700 border-yellow-200 font-bold'; // C - jaune
      } else if (hasReplacement) {
        return 'bg-orange-200 text-orange-800 border-orange-300 font-bold'; // R - légèrement plus foncé
      }
      
      // Couleur par défaut si aucune opération n'est spécifiée
      return 'bg-gray-50 text-gray-700 border-gray-200 font-bold';
    }
    
    // Pour les autres types, adapter les couleurs aux cellules
    switch (type) {
      case 'exchange':
        return 'bg-green-50 text-green-700 border-green-100 font-bold'; // Vert très pâle pour échange (E)
      case 'give':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200 font-bold'; // Jaune pour cession (C)
      case 'combined':
        return 'bg-lime-100 text-lime-800 border-lime-200 font-bold'; // Teinte intermédiaire jaune-vert pour combiné (CE)
      case 'replacement':
        return 'bg-orange-200 text-orange-800 border-orange-300 font-bold'; // Orange foncé pour remplaçant (R)
      case 'exchange-replacement':
        return 'bg-orange-100 text-orange-800 border-orange-200 font-bold'; // Orange pour échange + remplaçant (ER)
      case 'give-replacement':
        return 'bg-orange-100 text-orange-800 border-orange-200 font-bold'; // Orange pour cession + remplaçant (CR)
      case 'combined-replacement':
        return 'bg-orange-100 text-orange-800 border-orange-200 font-bold'; // Orange pour combiné + remplaçant (CER)
      case 'interested':
        return 'bg-green-100/70 text-green-800 border-green-200/70 font-bold'; // Vert semi-transparent pour intéressés
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200 font-bold';
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-200 font-bold';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200 font-bold';
    }
  };

  // Déterminer les classes de taille
  const getSizeClasses = () => {
    // Pour le type 'operation-types', utiliser des tailles plus petites
    if (type === 'operation-types') {
      switch (size) {
        case 'xs':
          return 'text-[5px] px-1 min-w-[8px] h-2 leading-none font-bold';
        case 'sm':
          return 'text-[6px] px-1 min-w-[10px] h-3 leading-none font-bold';
        case 'lg':
          return 'text-[8px] px-1 min-w-[14px] h-4 leading-none font-bold';
        case 'md':
        default:
          return 'text-[7px] px-1 min-w-[12px] h-3.5 leading-none font-bold';
      }
    }
    
    // Pour le type 'interested', utiliser une taille plus petite
    if (type === 'interested') {
      switch (size) {
        case 'xs':
          return 'text-[7px] px-0.5 min-w-[12px] h-3';
        case 'sm':
          return 'text-[8px] px-0.5 min-w-[14px] h-3.5';
        case 'lg':
          return 'text-[10px] px-1 min-w-[18px] h-5';
        case 'md':
        default:
          return 'text-[9px] px-1 min-w-[16px] h-4';
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
        font-medium rounded-full border border-[0.5px]
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
