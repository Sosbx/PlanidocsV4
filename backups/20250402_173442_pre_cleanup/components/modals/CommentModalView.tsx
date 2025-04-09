import React from 'react';
import { MessageSquare } from 'lucide-react';

interface CommentModalViewProps {
  isOpen: boolean;
  onClose: () => void;
  comment: string;
}

const CommentModalView: React.FC<CommentModalViewProps> = ({
  isOpen,
  onClose,
  comment
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-sm">
        <div className="flex items-start mb-4">
          <MessageSquare className="h-5 w-5 text-gray-400 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Commentaire
            </h3>
            <p className="text-gray-600 text-sm whitespace-pre-wrap">
              {comment}
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommentModalView