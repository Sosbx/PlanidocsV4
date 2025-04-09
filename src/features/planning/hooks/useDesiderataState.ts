import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from "../../../lib/firebase/config";
import { useAuth } from "../../../features/auth/hooks";

export const useDesiderataState = () => {
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
    const unsubscribe = onSnapshot(
      doc(db, 'desiderata', user.id),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data()?.selections || {};
          // Log détaillé pour comprendre la structure exacte des données
          console.log("Données de désiderata chargées:", data);
          console.log("Structure d'un élément:", Object.keys(data).length > 0 ? 
            Object.entries(data)[0] : "Aucun élément");
          
          // Log de vérification pour voir si les éléments ont une propriété 'type'
          if (Object.keys(data).length > 0) {
            const firstKey = Object.keys(data)[0];
            console.log(`Premier désiderata [${firstKey}]:`, data[firstKey], 
              "a une propriété type?", data[firstKey] && typeof data[firstKey] === 'object' ? 
              'type' in data[firstKey] : "N'est pas un objet");
          }
          
          // Transformer les données si nécessaire pour s'assurer qu'elles ont la structure attendue
          const formattedData: Record<string, { type: 'primary' | 'secondary' | null }> = {};
          
          // Parcourir toutes les entrées et les transformer au format attendu
          Object.entries(data).forEach(([key, value]) => {
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
          
          console.log("Données formatées:", formattedData);
          setSelectionsState(formattedData);
        } else {
          console.log("Aucune donnée de désiderata trouvée");
          setSelectionsState({});
        }
        setIsLoading(false);
      },
      (error) => {
        console.error('Error loading desiderata:', error);
        setSelectionsState({});
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const setSelections = (newSelections: Record<string, { type: 'primary' | 'secondary' | null }>) => {
    setSelectionsState(newSelections);
  };

  return {
    selections,
    setSelections,
    isLoading
  };
};