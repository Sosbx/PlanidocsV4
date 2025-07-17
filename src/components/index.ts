/**
 * Re-export common components to simplify imports
 */

// Export common components
export { default as Portal } from './Portal';
export { default as ConfirmationModal } from './ConfirmationModal';
export { default as PlanningGridCell } from './PlanningGridCell';
export { default as PlanningTable } from './PlanningTable';
export { default as Countdown } from './Countdown';
export { default as Tutorial } from './Tutorial';
export { default as ConfigurationDisplay } from './ConfigurationDisplay';
export { default as ShiftStatusBadge } from './ShiftStatusBadge';
export { default as Navbar } from './Navbar';

// Export modals
export { default as CommentModal } from './modals/CommentModal';
export { default as PlanningPreviewModal } from './modals/PlanningPreviewModal';
export { ExportModeModal } from './modals/ExportModeModal';
export { SyncDetailsModal } from './modals/SyncDetailsModal';
export { SyncModeModal } from './modals/SyncModeModal';

// Export Google Calendar components
export { GoogleCalendarSyncCompact } from './GoogleCalendarSyncCompact';
export { SyncResultsDetails } from './SyncResultsDetails';
