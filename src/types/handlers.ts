/**
 * Types pour les handlers et callbacks
 */

import { AppError } from './errors';

/**
 * Handler asynchrone générique
 */
export type AsyncHandler<T = void> = (data: T) => Promise<void>;

/**
 * Handler synchrone générique
 */
export type Handler<T = void> = (data: T) => void;

/**
 * Handler d'erreur
 */
export type ErrorHandler = (error: AppError | Error) => void;

/**
 * Handler de succès avec résultat
 */
export type SuccessHandler<T> = (result: T) => void;

/**
 * Handler de progression
 */
export type ProgressHandler = (progress: number, message?: string) => void;

/**
 * Event handlers React courants
 */
export type ClickHandler = React.MouseEventHandler<HTMLElement>;
export type FormHandler = React.FormEventHandler<HTMLFormElement>;
export type InputHandler = React.ChangeEventHandler<HTMLInputElement>;
export type SelectHandler = React.ChangeEventHandler<HTMLSelectElement>;
export type TextAreaHandler = React.ChangeEventHandler<HTMLTextAreaElement>;

/**
 * Handler pour les événements clavier
 */
export type KeyboardHandler = React.KeyboardEventHandler<HTMLElement>;

/**
 * Handler pour les événements de focus
 */
export type FocusHandler = React.FocusEventHandler<HTMLElement>;

/**
 * Handler pour les fichiers
 */
export interface FileHandler {
  (files: FileList | null): void;
}

/**
 * Handler pour le drag & drop
 */
export interface DragHandler {
  onDragEnter?: React.DragEventHandler;
  onDragLeave?: React.DragEventHandler;
  onDragOver?: React.DragEventHandler;
  onDrop?: React.DragEventHandler;
}

/**
 * Handler avec validation
 */
export interface ValidatedHandler<T> {
  (data: T, isValid: boolean): void;
}

/**
 * Handler avec annulation
 */
export interface CancellableHandler<T = void> {
  (data: T): void;
  cancel?: () => void;
}

/**
 * Handler de confirmation
 */
export interface ConfirmHandler {
  onConfirm: () => void;
  onCancel?: () => void;
}

/**
 * Handler de modal
 */
export interface ModalHandler<T = void> {
  onOpen?: () => void;
  onClose?: () => void;
  onSubmit?: (data: T) => void;
}

/**
 * Handler de pagination
 */
export interface PaginationHandler {
  onNext?: () => void;
  onPrevious?: () => void;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

/**
 * Handler de tri
 */
export interface SortHandler {
  onSort: (field: string, direction: 'asc' | 'desc') => void;
}

/**
 * Handler de filtre
 */
export interface FilterHandler<T = Record<string, unknown>> {
  onFilter: (filters: T) => void;
  onReset?: () => void;
}

/**
 * Handler de sélection
 */
export interface SelectionHandler<T> {
  onSelect: (item: T) => void;
  onDeselect?: (item: T) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
}

/**
 * Créer un handler sécurisé qui gère les erreurs
 */
export function createSafeHandler<T = void>(
  handler: AsyncHandler<T>,
  errorHandler?: ErrorHandler
): AsyncHandler<T> {
  return async (data: T) => {
    try {
      await handler(data);
    } catch (error) {
      if (errorHandler) {
        errorHandler(error as Error);
      } else {
        console.error('Unhandled error in handler:', error);
      }
    }
  };
}

/**
 * Créer un handler avec debounce
 */
export function createDebouncedHandler<T = void>(
  handler: Handler<T>,
  delay: number
): Handler<T> & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout;
  
  const debouncedHandler = (data: T) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => handler(data), delay);
  };
  
  debouncedHandler.cancel = () => clearTimeout(timeoutId);
  
  return debouncedHandler;
}