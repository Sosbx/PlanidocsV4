import React, { useState } from 'react';
import { Calendar, Loader2, CheckCircle2 } from 'lucide-react';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import type { ShiftAssignment } from '../types/planning';
import { SyncModeModal } from './modals/SyncModeModal';
import { SyncProgressBar } from './SyncProgressBar';

interface GoogleCalendarSyncCompactProps {
  assignments: Record<string, ShiftAssignment>;
  disabled?: boolean;
  onSyncComplete?: () => void;
}

export const GoogleCalendarSyncCompact: React.FC<GoogleCalendarSyncCompactProps> = ({
  assignments,
  disabled = false,
  onSyncComplete,
}) => {
  const {
    isAuthenticated,
    isSyncing,
    syncProgress,
    login,
    logout,
    smartSync,
  } = useGoogleCalendar();

  const [eventMode, setEventMode] = useState<'grouped' | 'separated'>(() => {
    const saved = localStorage.getItem('planidocs_event_mode');
    return saved === 'separated' ? 'separated' : 'grouped';
  });

  const [showModeModal, setShowModeModal] = useState(false);

  const handleButtonClick = () => {
    if (!isAuthenticated) {
      login();
    } else {
      setShowModeModal(true);
    }
  };

  const handleSyncConfirm = async (mode: 'grouped' | 'separated', colorId: string) => {
    setEventMode(mode);
    localStorage.setItem('planidocs_event_mode', mode);
    await smartSync(assignments, mode, colorId);
    onSyncComplete?.();
  };

  const shiftCount = Object.values(assignments).filter(a => a && a.shiftType).length;

  return (
    <div className="relative inline-block">
      <button
        onClick={handleButtonClick}
        disabled={disabled || isSyncing || shiftCount === 0}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
          transition-all duration-200
          ${isAuthenticated 
            ? 'bg-blue-600 hover:bg-blue-700 text-white' 
            : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'
          }
          ${(disabled || shiftCount === 0) ? 'opacity-50 cursor-not-allowed' : ''}
          ${isSyncing ? 'cursor-wait' : ''}
        `}
        title={isAuthenticated ? 'Synchroniser avec Google Calendar' : 'Connecter Google Calendar'}
      >
        {isSyncing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Calendar className="w-4 h-4" />
        )}
        <span>{isAuthenticated ? 'Sync GoogleCal' : 'Connecter GoogleCal'}</span>
        {isAuthenticated && (
          <CheckCircle2 className="w-3 h-3 text-green-300" />
        )}
      </button>

      {/* Barre de progression */}
      {isSyncing && syncProgress && (
        <div className="absolute top-full left-0 right-0 mt-2 min-w-[200px] bg-white p-2 rounded shadow-lg border border-gray-200">
          <SyncProgressBar progress={syncProgress} />
        </div>
      )}

      {/* Modal de sélection du mode */}
      <SyncModeModal
        isOpen={showModeModal}
        onClose={() => setShowModeModal(false)}
        onConfirm={handleSyncConfirm}
        onLogout={() => {
          logout();
          setShowModeModal(false);
        }}
        currentMode={eventMode}
      />
    </div>
  );
};