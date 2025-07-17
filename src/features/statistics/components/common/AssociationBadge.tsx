import React from 'react';
import { MapPin } from 'lucide-react';

interface AssociationBadgeProps {
  association: string;
}

const AssociationBadge: React.FC<AssociationBadgeProps> = ({ association }) => {
  const isRD = association === 'RD';
  
  return (
    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
      isRD 
        ? 'bg-blue-100 text-blue-800' 
        : 'bg-green-100 text-green-800'
    }`}>
      <MapPin className="h-3 w-3 mr-1" />
      {isRD ? 'Rive Droite' : 'Rive Gauche'}
    </div>
  );
};

export default AssociationBadge;