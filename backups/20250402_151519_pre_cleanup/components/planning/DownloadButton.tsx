import React from 'react';
import { Download } from 'lucide-react';
import { exportPlanningToExcel } from '../../utils/excelExport';
import { exportPlanningToPDF } from '../../utils/pdfExport';

interface DownloadButtonProps {
  userName: string;
  startDate: Date;
  endDate: Date;
  selections: Record<string, 'primary' | 'secondary' | null>;
  disabled?: boolean;
}

const DownloadButton: React.FC<DownloadButtonProps> = ({
  userName,
  startDate,
  endDate,
  selections,
  disabled = false
}) => {
  const handleDownload = async () => {
    try {
      exportPlanningToPDF({
        userName,
        startDate,
        endDate,
        selections
      });
    } catch (error) {
      console.error('Error downloading planning:', error);
    }
  };

  return (
    <button 
      onClick={handleDownload}
      disabled={disabled}
      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Download className="h-4 w-4 mr-2" />
      Télécharger
    </button>
  );
};

export default DownloadButton;