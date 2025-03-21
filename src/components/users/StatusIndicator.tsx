import React from 'react';

interface StatusIndicatorProps {
  validated: boolean;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ validated }) => {
  return (
    <div
      className={`h-3 w-3 rounded-full ${
        validated ? 'bg-green-500' : 'bg-red-500'
      }`}
      title={validated ? 'Planning validé' : 'Planning non validé'}
    />
  );
};

export default StatusIndicator;