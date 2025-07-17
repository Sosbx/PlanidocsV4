import React from 'react';
import { Download, FileSpreadsheet, FileText, Image } from 'lucide-react';

interface ExportButtonsProps {
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  onExportImage?: () => void;
  disabled?: boolean;
}

const ExportButtons: React.FC<ExportButtonsProps> = ({
  onExportPDF,
  onExportExcel,
  onExportImage,
  disabled = false
}) => {
  return (
    <div className="flex items-center gap-2">
      {onExportPDF && (
        <button
          onClick={onExportPDF}
          disabled={disabled}
          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Exporter en PDF"
        >
          <FileText className="h-4 w-4 mr-1" />
          PDF
        </button>
      )}
      
      {onExportExcel && (
        <button
          onClick={onExportExcel}
          disabled={disabled}
          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Exporter en Excel"
        >
          <FileSpreadsheet className="h-4 w-4 mr-1" />
          Excel
        </button>
      )}
      
      {onExportImage && (
        <button
          onClick={onExportImage}
          disabled={disabled}
          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Exporter en image"
        >
          <Image className="h-4 w-4 mr-1" />
          Image
        </button>
      )}
    </div>
  );
};

export default ExportButtons;