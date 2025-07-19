// Types pour l'intégration Google Calendar

export interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    date?: string; // Pour les événements journée entière (format: YYYY-MM-DD)
    dateTime?: string; // Pour les événements avec heure
    timeZone?: string;
  };
  end: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
  colorId?: string;
  extendedProperties?: {
    private?: Record<string, string>;
    shared?: Record<string, string>;
  };
}

export interface SyncEventDetail {
  date: string;
  shiftType: string;
  period?: 'M' | 'AM' | 'S';
  timeSlot?: string;
}

export interface SyncUpdateDetail extends SyncEventDetail {
  previousShiftType?: string;
}

export interface ConvertedEventDetail {
  date: string;
  fromMode: 'grouped' | 'separated';
  toMode: 'grouped' | 'separated';
  shiftType: string;
}

export interface GoogleCalendarSyncResult {
  created: number;
  updated: number;
  deleted: number;
  converted: number;
  migrated: number;
  errors: Array<{
    date: string;
    error: string;
  }>;
  // Détails des modifications
  createdEvents?: SyncEventDetail[];
  updatedEvents?: SyncUpdateDetail[];
  deletedEvents?: SyncEventDetail[];
  convertedEvents?: ConvertedEventDetail[];
  migratedEvents?: SyncEventDetail[];
}

export interface SyncProgress {
  current: number;
  total: number;
  message: string;
  phase: 'analyzing' | 'migrating' | 'creating' | 'updating' | 'deleting' | 'finalizing';
}

export interface GoogleCalendarSyncStatus {
  isAuthenticated: boolean;
  isSyncing: boolean;
  syncProgress: SyncProgress | null;
  lastSync: Date | null;
  lastSyncResult: GoogleCalendarSyncResult | null;
}

export interface CalendarSyncRecord {
  userId: string;
  assignmentKey: string; // Format: "YYYY-MM-DD-TYPE"
  googleEventId: string;
  lastSyncedAt: Date;
  eventData: {
    date: string;
    shiftTypes: string[];
  };
}