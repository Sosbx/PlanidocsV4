import React from 'react';

export type BadgeType = 'exchange' | 'give' | 'replacement' | 'interested' | 'pending' | 'completed';
export type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  type: BadgeType;
  count?: number;
  size?: BadgeSize;
  className?: string;
}

/**
 * Composant Badge réutilisable pour afficher des pastilles avec compteur
 * Utilisé pour indiquer le statut des gardes et le nombre d'utilisateurs intéressés
 */
const Badge: React.FC<BadgeProps> = ({ 
  type, 
  count, 
  size = 'md',
  className = '' 
}) => {
  // Déterminer les classes de style en fonction du type
  const getTypeClasses = () => {
    switch (type) {
      case 'exchange':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'give':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'replacement':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'interested':
        return 'bg-blue-100 text-blue-800 border-blue-200';
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
      case 'replacement':
        return 'R';
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
      `}
      title={
        type === 'exchange' ? 'Échange proposé' :
        type === 'give' ? 'Cession proposée' :
        type === 'replacement' ? 'Proposé aux remplaçants' :
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
