import React from 'react';
import { ShiftPeriod } from '../types/exchange';
import { getPeriodDisplayText } from '../utils/dateUtils';

export type ShiftStatus = 'interested' | 'conflict' | 'replacement' | 'unavailable' | 'normal';

interface ShiftStatusBadgeProps {
  period: ShiftPeriod | string;
  status?: ShiftStatus;
  shiftType?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  isUserShift?: boolean;
  showPeriodText?: boolean;
  id?: string;
  children?: React.ReactNode;
  withAnimation?: boolean;
  isPrimaryDesiderata?: boolean;
  isSecondaryDesiderata?: boolean;
}

/**
 * Composant de badge standardisé pour les périodes de garde
 * Supporte différents statuts et tailles
 */
const ShiftStatusBadge: React.FC<ShiftStatusBadgeProps> = ({
  period,
  status = 'normal',
  shiftType,
  size = 'md',
  className = '',
  onClick,
  disabled = false,
  isUserShift = false,
  showPeriodText = false,
  id,
  children,
  withAnimation = true,
  isPrimaryDesiderata = false,
  isSecondaryDesiderata = false
}) => {
  // Normaliser la période
  const normalizedPeriod = typeof period === 'string' 
    ? period as ShiftPeriod 
    : period;
  
  // Déterminer les classes CSS en fonction de la période et du statut
  const periodClass = normalizedPeriod === ShiftPeriod.MORNING
    ? 'badge-morning'
    : normalizedPeriod === ShiftPeriod.AFTERNOON
      ? 'badge-afternoon'
      : 'badge-evening';
  
  const statusClass = status !== 'normal' 
    ? `badge-${status}` 
    : '';
  
  const sizeClassMap = {
    sm: 'min-w-[30px] h-[30px] text-xs', 
    md: 'min-w-[38px] h-[38px] text-sm',
    lg: 'min-w-[46px] h-[46px] text-base'
  };
  
  const sizeClass = sizeClassMap[size];
  const cursorClass = onClick && !disabled 
    ? 'cursor-pointer' 
    : disabled ? 'cursor-not-allowed opacity-70' : '';
  
  // Créer l'identifiant unique si non fourni
  const badgeId = id || `shift-badge-${Math.random().toString(36).substring(2, 9)}`;
  
  return (
    <div
      id={badgeId}
      onClick={disabled ? undefined : onClick}
      className={`
        ${periodClass}
        ${statusClass}
        ${sizeClass}
        ${cursorClass}
        ${className}
        ${withAnimation ? 'transition-all duration-200' : ''}
        flex-shrink-0 rounded-md font-bold shadow-sm 
        flex justify-center items-center relative
      `}
    >
      <div className="flex flex-col items-center justify-center">
        {shiftType && <span className="font-bold">{shiftType}</span>}
        {showPeriodText && (
          <span className="text-xs opacity-80">
            {getPeriodDisplayText(normalizedPeriod)}
          </span>
        )}
        {children}
      </div>
      
      {/* Indicateur visuel pour les gardes de l'utilisateur */}
      {isUserShift && (
        <div className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 bg-indigo-500 rounded-full border border-white" />
      )}
      
      {/* Indicateur visuel pour les désidératas */}
      {isPrimaryDesiderata && (
        <div className="absolute -top-0.5 left-0 right-0 h-1 bg-red-400 rounded-t-sm" 
             title="Désidérata primaire" />
      )}
      {isSecondaryDesiderata && (
        <div className="absolute -top-0.5 left-0 right-0 h-1 bg-blue-400 rounded-t-sm" 
             title="Désidérata secondaire" />
      )}
    </div>
  );
};

export default ShiftStatusBadge;
