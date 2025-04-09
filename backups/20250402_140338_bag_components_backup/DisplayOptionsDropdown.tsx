import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, Eye } from 'lucide-react';
import Portal from '../Portal';

interface DisplayOptionsDropdownProps {
  showOwnShifts: boolean;
  setShowOwnShifts: (show: boolean) => void;
  showMyInterests: boolean;
  setShowMyInterests: (show: boolean) => void;
  showDesiderata: boolean;
  setShowDesiderata: (show: boolean) => void;
  hidePrimaryDesiderata: boolean;
  setHidePrimaryDesiderata: (hide: boolean) => void;
  hideSecondaryDesiderata: boolean;
  setHideSecondaryDesiderata: (hide: boolean) => void;
  isInteractionDisabled: boolean;
}

const DisplayOptionsDropdown: React.FC<DisplayOptionsDropdownProps> = ({
  showOwnShifts,
  setShowOwnShifts,
  showMyInterests,
  setShowMyInterests,
  showDesiderata,
  setShowDesiderata,
  hidePrimaryDesiderata,
  setHidePrimaryDesiderata,
  hideSecondaryDesiderata,
  setHideSecondaryDesiderata,
  isInteractionDisabled
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);

  // Gérer le toggle du dropdown
  const toggleDropdown = useCallback(() => {
    if (!isOpen && buttonRef.current) {
      // Capturer la position du bouton quand on ouvre le menu
      const rect = buttonRef.current.getBoundingClientRect();
      setButtonRect(rect);
    }
    setIsOpen(prevIsOpen => !prevIsOpen);
  }, [isOpen]);

  // Référence pour le menu déroulant
  const menuRef = useRef<HTMLDivElement>(null);

  // Ferme le dropdown quand on clique ailleurs (mais pas dans le menu)
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      // Ne ferme pas si on clique sur le bouton
      if (buttonRef.current && buttonRef.current.contains(event.target as Node)) {
        return;
      }
      
      // Ne ferme pas si on clique sur le menu
      if (menuRef.current && menuRef.current.contains(event.target as Node)) {
        return;
      }
      
      // Dans tous les autres cas, ferme le menu
      setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleDropdown}
        className={`flex items-center justify-between gap-1 px-2.5 py-1.5 rounded-md shadow-sm text-xs font-medium transition-all min-w-[100px] ${
          isOpen 
            ? 'bg-indigo-50 text-indigo-700 border border-indigo-300 ring-1 ring-indigo-200' 
            : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
        }`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Eye className="h-3.5 w-3.5 text-indigo-600 mr-1 shrink-0" />
        <span>Affichage</span>
        <ChevronDown className={`h-3.5 w-3.5 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} shrink-0 ml-1`} />
      </button>

      {isOpen && buttonRect && (
        <Portal>
          {/* Couche invisible qui couvre tout l'écran sauf le menu */}
          <div 
            className="fixed inset-0 z-40 bg-transparent"
            onClick={(e) => {
              // Cette couche gère uniquement les clics qui ne sont pas sur le menu ou le bouton
              if (
                menuRef.current && !menuRef.current.contains(e.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(e.target as Node)
              ) {
                setIsOpen(false);
              }
            }}
          />
          {/* Menu déroulant */}
          <div 
            ref={menuRef}
            className="fixed z-50 bg-white rounded-md shadow-xl border border-gray-300 py-1 text-xs animate-dropdown"
            style={{ 
              top: `${buttonRect.bottom + 4}px`, 
              right: `${Math.max(8, window.innerWidth - buttonRect.right)}px`,
              width: '240px',
              transformOrigin: 'top right'
            }}
          >
            <div className="px-3 py-1.5 text-xs font-medium text-indigo-800 border-b border-gray-100 bg-indigo-50">
              Options d'affichage
            </div>
            <div className="p-2 space-y-1.5">
              {/* Options générales */}
              <div>
                <p className="text-xs text-gray-600 font-medium mb-1 pl-2">Afficher</p>
                <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-3 py-1.5 rounded-md transition-colors">
                  <input
                    type="checkbox"
                    checked={showOwnShifts}
                    onChange={(e) => {
                      e.stopPropagation(); // Empêche la propagation du clic
                      setShowOwnShifts(e.target.checked);
                    }}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                    disabled={isInteractionDisabled}
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-gray-800">Mes gardes</span>
                    <span className="text-[9px] text-gray-500">Affiche mes propres gardes</span>
                  </div>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-3 py-1.5 rounded-md transition-colors">
                  <input
                    type="checkbox"
                    checked={showMyInterests}
                    onChange={(e) => {
                      e.stopPropagation(); // Empêche la propagation du clic
                      setShowMyInterests(e.target.checked);
                    }}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500 h-3.5 w-3.5"
                    disabled={isInteractionDisabled}
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-gray-800">Mes positions</span>
                    <span className="text-[9px] text-gray-500">Affiche seulement les gardes sur lesquelles je suis positionné(e)</span>
                  </div>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-3 py-1.5 rounded-md transition-colors">
                  <input
                    type="checkbox"
                    checked={showDesiderata}
                    onChange={(e) => {
                      e.stopPropagation(); // Empêche la propagation du clic
                      setShowDesiderata(e.target.checked);
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-gray-800">Désidératas</span>
                    <span className="text-[9px] text-gray-500">Affiche mes désidérata</span>
                  </div>
                </label>
              </div>
              
              {/* Séparateur */}
              <div className="border-t border-gray-100 my-1"></div>
              
              {/* Options masquage */}
              <div>
                <p className="text-xs text-gray-600 font-medium mb-1 pl-2">Masquer les positions sur</p>
                <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-3 py-1.5 rounded-md transition-colors">
                  <input
                    type="checkbox"
                    checked={hidePrimaryDesiderata}
                    onChange={(e) => {
                      e.stopPropagation(); // Empêche la propagation du clic
                      setHidePrimaryDesiderata(e.target.checked);
                    }}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500 h-3.5 w-3.5"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-gray-800">Désidératas I</span>
                    <span className="text-[9px] text-gray-500">Masque les propositions sur mes désidératas primaires</span>
                  </div>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-3 py-1.5 rounded-md transition-colors">
                  <input
                    type="checkbox"
                    checked={hideSecondaryDesiderata}
                    onChange={(e) => {
                      e.stopPropagation(); // Empêche la propagation du clic
                      setHideSecondaryDesiderata(e.target.checked);
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-gray-800">Désidératas II</span>
                    <span className="text-[9px] text-gray-500">Masque les propositions sur mes désidératas secondaires</span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
};

export default DisplayOptionsDropdown;