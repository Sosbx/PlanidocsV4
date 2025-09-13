import React from 'react';
import ExchangeHistoryList from './ExchangeHistoryList';
import type { ExchangeHistory as ExchangeHistoryType, BagPhaseConfig } from '../../../../types/planning';
import type { User } from '../../../../types/users';

interface ExchangeHistoryProps {
  history: ExchangeHistoryType[];
  users: User[];
  bagPhaseConfig: BagPhaseConfig;
  onRevertExchange: (historyId: string) => void;
}

const ExchangeHistoryComponent: React.FC<ExchangeHistoryProps> = ({
  history,
  users,
  bagPhaseConfig,
  onRevertExchange
}) => {
  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          Historique des échanges
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Liste des échanges validés
        </p>
      </div>
      <div className="px-4 py-5 sm:p-0">
        <ExchangeHistoryList
          history={history}
          users={users}
          bagPhaseConfig={bagPhaseConfig}
          onRevertExchange={onRevertExchange}
        />
      </div>
    </div>
  );
};

export default ExchangeHistoryComponent;
