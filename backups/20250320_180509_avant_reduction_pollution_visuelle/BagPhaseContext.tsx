import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { BagPhaseConfig, defaultBagPhaseConfig } from '../types/planning';

interface BagPhaseContextType {
  config: BagPhaseConfig;
  updateConfig: (newConfig: BagPhaseConfig) => Promise<void>;
}

const BagPhaseContext = createContext<BagPhaseContextType | undefined>(undefined);

const BAG_CONFIG_DOC = 'bag_phase_config';

export const BagPhaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<BagPhaseConfig>(defaultBagPhaseConfig);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'config', BAG_CONFIG_DOC), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setConfig({
          ...data,
          submissionDeadline: data.submissionDeadline.toDate(),
          isConfigured: true,
        });
      } else {
        setConfig(defaultBagPhaseConfig);
      }
    });

    return () => unsubscribe();
  }, []);

  const updateConfig = async (newConfig: BagPhaseConfig) => {
    const configRef = doc(db, 'config', BAG_CONFIG_DOC);
    await setDoc(configRef, {
      ...newConfig,
      submissionDeadline: newConfig.submissionDeadline,
    });
  };

  return (
    <BagPhaseContext.Provider value={{ config, updateConfig }}>
      {children}
    </BagPhaseContext.Provider>
  );
};

export const useBagPhase = () => {
  const context = useContext(BagPhaseContext);
  if (context === undefined) {
    throw new Error('useBagPhase must be used within a BagPhaseProvider');
  }
  return context;
};