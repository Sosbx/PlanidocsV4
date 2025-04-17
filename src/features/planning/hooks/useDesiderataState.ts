import { useState, useEffect } from 'react';
import { useAuth } from "../../../features/auth/hooks";
import { getAllDesiderata } from "../../../lib/firebase/desiderata";

export const useDesiderataState = (includeArchived: boolean = false) => {
  const { user } = useAuth();
  // Nous changeons la structure pour s'adapter aux composants qui attendent une propriété type
  const [selections, setSelectionsState] = useState<Record<string, { type: 'primary' | 'secondary' | null }>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSelectionsState({});
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    // Utiliser getAllDesiderata avec le paramètre includeArchived
    const loadDesiderata = async () => {
      try {
        const data = await getAllDesiderata(user.id, includeArchived);
        
        if (data?.selections) {
          // Log détaillé pour comprendre la structure exacte des données
          console.log(`Données de désiderata chargées (${includeArchived ? 'incluant' : 'excluant'} archivées):`, data.selections);
          
          // Transformer les données si nécessaire pour s'assurer qu'elles ont la structure attendue
          const formattedData: Record<string, { type: 'primary' | 'secondary' | null }> = {};
          
          // Parcourir toutes les entrées et les transformer au format attendu
          Object.entries(data.selections).forEach(([key, value]) => {
            // Si la valeur est déjà un objet avec une propriété type, l'utiliser tel quel
            if (value && typeof value === 'object' && 'type' in value) {
              formattedData[key] = value as { type: 'primary' | 'secondary' | null };
            } 
            // Si la valeur est directement 'primary' ou 'secondary', la transformer en objet
            else if (value === 'primary' || value === 'secondary' || value === null) {
              formattedData[key] = { type: value };
            }
            // Dans les autres cas, considérer comme null
            else {
              formattedData[key] = { type: null };
            }
          });
          
          console.log(`Données formatées (${includeArchived ? 'incluant' : 'excluant'} archivées):`, formattedData);
          setSelectionsState(formattedData);
        } else {
          console.log("Aucune donnée de désiderata trouvée");
          setSelectionsState({});
        }
      } catch (error) {
        console.error('Error loading desiderata:', error);
        setSelectionsState({});
      } finally {
        setIsLoading(false);
      }
    };
    
    loadDesiderata();
    
    // Pas besoin d'un unsubscribe car nous n'utilisons plus onSnapshot
    return () => {};
  }, [user, includeArchived]);

  const setSelections = (newSelections: Record<string, { type: 'primary' | 'secondary' | null }>) => {
    setSelectionsState(newSelections);
  };

  return {
    selections,
    setSelections,
    isLoading
  };
};
