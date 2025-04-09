import React from 'react';
import DirectExchangeContainer from '../components/exchange/direct/DirectExchangeContainer';

/**
 * Page d'échanges directs
 * Version refactorisée utilisant le composant DirectExchangeContainer
 * qui encapsule toute la logique et les composants UI
 */
const DirectExchangePage: React.FC = () => {
  return <DirectExchangeContainer />;
};

export default DirectExchangePage;
