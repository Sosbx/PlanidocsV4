import React from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean;
}

const Logo: React.FC<LogoProps> = ({ className = '', showText = true }) => {
  return (
    <div className={`flex items-center ${className}`}>
      <img 
        src="/Logo.png" 
        alt="PlaniDoc Logo" 
        className="h-16 w-16 object-contain"
      />
      {showText && (
        <h1 className="ml-3 text-2xl font-bold text-white flex items-start">
          PlaniDoc<span className="text-sm">s</span>
        </h1>
      )}
    </div>
  );
};

export default Logo;