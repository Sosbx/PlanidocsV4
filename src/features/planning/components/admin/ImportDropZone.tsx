import React, { useCallback, useState } from 'react';
import { Upload, AlertCircle, FileText, Check } from 'lucide-react';

interface ImportDropZoneProps {
  onFilesAccepted: (files: File[]) => void;
  isProcessing: boolean;
  uploadPeriodId: string;
  acceptedFileTypes?: string[];
  maxFileSize?: number; // en Mo
}

/**
 * Composant pour glisser-déposer des fichiers CSV
 */
const ImportDropZone: React.FC<ImportDropZoneProps> = ({
  onFilesAccepted,
  isProcessing,
  uploadPeriodId,
  acceptedFileTypes = ['.csv'],
  maxFileSize = 10 // 10 Mo par défaut
}) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [previewFiles, setPreviewFiles] = useState<File[]>([]);

  /**
   * Vérifie si un fichier est valide (type et taille)
   */
  const validateFile = (file: File): string | null => {
    // Vérifier le type de fichier
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedFileTypes.includes(fileExtension)) {
      return `Type de fichier non accepté: ${fileExtension}. Types acceptés: ${acceptedFileTypes.join(', ')}`;
    }
    
    // Vérifier la taille du fichier
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxFileSize) {
      return `Fichier trop volumineux: ${fileSizeMB.toFixed(2)} Mo. Maximum: ${maxFileSize} Mo`;
    }
    
    return null;
  };

  /**
   * Gère le dépôt de fichiers
   */
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragActive(false);
      
      if (!uploadPeriodId) {
        setFileErrors(['Veuillez sélectionner une période pour l\'import']);
        return;
      }
      
      const droppedFiles = Array.from(e.dataTransfer.files);
      const errors: string[] = [];
      const validFiles: File[] = [];
      
      droppedFiles.forEach(file => {
        const error = validateFile(file);
        if (error) {
          errors.push(`${file.name}: ${error}`);
        } else {
          validFiles.push(file);
        }
      });
      
      if (errors.length > 0) {
        setFileErrors(errors);
      } else {
        setFileErrors([]);
      }
      
      if (validFiles.length > 0) {
        setPreviewFiles(validFiles);
        onFilesAccepted(validFiles);
      }
    },
    [onFilesAccepted, uploadPeriodId, acceptedFileTypes, maxFileSize]
  );

  /**
   * Gère le clic sur la zone de dépôt pour sélectionner des fichiers
   */
  const handleClick = () => {
    if (isProcessing || !uploadPeriodId) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = acceptedFileTypes.join(',');
    
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        const selectedFiles = Array.from(target.files);
        const errors: string[] = [];
        const validFiles: File[] = [];
        
        selectedFiles.forEach(file => {
          const error = validateFile(file);
          if (error) {
            errors.push(`${file.name}: ${error}`);
          } else {
            validFiles.push(file);
          }
        });
        
        if (errors.length > 0) {
          setFileErrors(errors);
        } else {
          setFileErrors([]);
        }
        
        if (validFiles.length > 0) {
          setPreviewFiles(validFiles);
          onFilesAccepted(validFiles);
        }
      }
    };
    
    input.click();
  };

  /**
   * Gère l'entrée du curseur dans la zone de dépôt
   */
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  /**
   * Gère la sortie du curseur de la zone de dépôt
   */
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  /**
   * Empêche le comportement par défaut du navigateur
   */
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  return (
    <div className="mb-4">
      <div
        className={`flex flex-col items-center justify-center px-6 py-8 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
          isDragActive
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-gray-300 hover:border-indigo-500'
        } ${isProcessing || !uploadPeriodId ? 'opacity-50 cursor-not-allowed' : ''}`}
        onDrop={handleDrop}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onClick={handleClick}
      >
        <Upload
          className={`h-10 w-10 mb-3 ${
            isDragActive ? 'text-indigo-500' : 'text-gray-400'
          }`}
        />
        
        <p className="mb-2 text-sm text-center text-gray-700">
          {isProcessing
            ? 'Traitement en cours...'
            : !uploadPeriodId
            ? 'Veuillez sélectionner une période'
            : isDragActive
            ? 'Déposez les fichiers ici'
            : 'Glissez-déposez des fichiers CSV ou cliquez pour sélectionner'}
        </p>
        
        <p className="text-xs text-gray-500">
          {acceptedFileTypes.join(', ')} (max. {maxFileSize} Mo)
        </p>
      </div>

      {/* Affichage des erreurs */}
      {fileErrors.length > 0 && (
        <div className="mt-4 p-4 bg-red-50 rounded-md">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Erreurs lors de l'import
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <ul className="list-disc pl-5 space-y-1">
                  {fileErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prévisualisation des fichiers */}
      {previewFiles.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Fichiers sélectionnés ({previewFiles.length})
          </h3>
          <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md overflow-hidden">
            {previewFiles.map((file, index) => (
              <li
                key={index}
                className="flex items-center px-4 py-3 bg-white hover:bg-gray-50"
              >
                <FileText className="h-5 w-5 text-gray-400 mr-3" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(2)} Ko
                  </p>
                </div>
                <Check className="h-5 w-5 text-green-500" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ImportDropZone;
