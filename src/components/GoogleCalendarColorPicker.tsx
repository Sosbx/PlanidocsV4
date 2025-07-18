import React from 'react';
import { Check } from 'lucide-react';

interface GoogleCalendarColor {
  id: string;
  name: string;
  background: string;
  foreground: string;
}

// Couleurs officielles de Google Calendar classées par teinte
const GOOGLE_CALENDAR_COLORS: GoogleCalendarColor[] = [
  // Gris
  { id: '8', name: 'Graphite', background: '#616161', foreground: '#ffffff' },
  // Rouges/Roses
  { id: '11', name: 'Tomate', background: '#d50000', foreground: '#ffffff' },
  { id: '4', name: 'Flamingo', background: '#e67c73', foreground: '#ffffff' },
  // Oranges/Jaunes
  { id: '6', name: 'Mandarine', background: '#f4511e', foreground: '#ffffff' },
  { id: '5', name: 'Banane', background: '#f6bf26', foreground: '#000000' },
  // Verts
  { id: '10', name: 'Basilic', background: '#0b8043', foreground: '#ffffff' },
  { id: '2', name: 'Sauge', background: '#33b679', foreground: '#ffffff' },
  // Bleus
  { id: '7', name: 'Paon', background: '#039be5', foreground: '#ffffff' },
  { id: '9', name: 'Myrtille', background: '#3f51b5', foreground: '#ffffff' },
  { id: '1', name: 'Lavande', background: '#7986cb', foreground: '#ffffff' },
  // Violet
  { id: '3', name: 'Raisin', background: '#8e24aa', foreground: '#ffffff' },
];

interface GoogleCalendarColorPickerProps {
  selectedColorId: string;
  onColorChange: (colorId: string) => void;
}

export const GoogleCalendarColorPicker: React.FC<GoogleCalendarColorPickerProps> = ({
  selectedColorId,
  onColorChange,
}) => {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-700">Couleur des événements</h3>
      <div className="flex gap-2 justify-between">
        {GOOGLE_CALENDAR_COLORS.map((color) => (
          <button
            key={color.id}
            onClick={() => onColorChange(color.id)}
            className={`
              relative w-6 h-6 rounded-full border transition-all
              ${selectedColorId === color.id 
                ? 'scale-125 shadow-lg ring-2 ring-offset-2' 
                : 'hover:scale-110'
              }
            `}
            style={{ 
              backgroundColor: color.background,
              borderColor: color.background,
              ringColor: selectedColorId === color.id ? color.background : undefined
            }}
            title={color.name}
          >
            {selectedColorId === color.id && (
              <Check 
                className="absolute inset-0 m-auto w-3 h-3" 
                style={{ color: color.foreground }}
              />
            )}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Cette couleur sera appliquée à tous vos événements de garde dans Google Calendar
      </p>
    </div>
  );
};