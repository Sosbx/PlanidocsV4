# Composants d'administration pour la bourse aux gardes

Ce dossier contient les composants React utilisés pour l'administration de la bourse aux gardes.

## Composants

### ExchangeList

Affiche la liste des échanges disponibles dans la bourse aux gardes. Ce composant permet aux administrateurs de :

- Voir tous les échanges en cours
- Voir les utilisateurs intéressés par chaque échange
- Valider un échange avec un utilisateur intéressé
- Rejeter un échange
- Proposer un échange aux remplaçants

### ExchangeHistoryComponent

Affiche l'historique des échanges validés. Ce composant est un conteneur qui utilise `ExchangeHistoryList` pour afficher les données.

### ExchangeHistoryList

Affiche la liste détaillée de l'historique des échanges. Ce composant permet aux administrateurs de :

- Voir tous les échanges validés
- Voir les détails de chaque échange (date, utilisateurs, etc.)
- Annuler un échange validé
- Notifier les utilisateurs concernés par un échange

### InterestedUserCard

Affiche les informations d'un utilisateur intéressé par un échange. Ce composant est utilisé par `ExchangeList` pour afficher les utilisateurs intéressés par chaque échange.

## Utilisation

Ces composants sont utilisés dans la page d'administration de la bourse aux gardes (`AdminShiftExchangePage`).

```tsx
import { 
  ExchangeList, 
  ExchangeHistoryComponent 
} from 'src/features/shiftExchange/components';

// Dans un composant
return (
  <div>
    <ExchangeList 
      exchanges={exchanges}
      users={users}
      bagPhaseConfig={bagPhaseConfig}
      conflictStates={conflictStates}
      userAssignments={userAssignments}
      onValidateExchange={handleValidateExchange}
      onRejectExchange={handleRejectExchange}
      onRemoveUser={handleRemoveUser}
      history={history}
    />
    
    <ExchangeHistoryComponent
      history={history}
      users={users}
      bagPhaseConfig={bagPhaseConfig}
      onRevertExchange={handleRevertExchange}
      onNotify={handleNotify}
    />
  </div>
);
```

## Notes techniques

- Ces composants utilisent TailwindCSS pour le style
- Les composants sont responsives avec des versions desktop et mobile
- Les composants utilisent les icônes de Lucide React
- Les types sont importés depuis `src/types/planning` et `src/types/users`
