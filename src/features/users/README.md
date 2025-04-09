# Feature de Gestion des Utilisateurs

Cette fonctionnalité permet de gérer les utilisateurs, leurs profils, leurs préférences et leurs statistiques.

## Structure du dossier

La fonctionnalité est organisée selon une architecture orientée feature, avec les sous-dossiers suivants :

- **components/** : Composants React spécifiques à la gestion des utilisateurs
  - `UserList.tsx` : Liste des utilisateurs
  - `UserCard.tsx` : Carte utilisateur
  - `UserProfile.tsx` : Profil utilisateur
  - `UserForm.tsx` : Formulaire de création/édition d'utilisateur
  - `index.ts` : Exporte tous les composants

- **hooks/** : Hooks React spécifiques à la gestion des utilisateurs
  - `useUsers.tsx` : Hook principal pour la gestion des utilisateurs
  - `useUserProfile.tsx` : Hook pour la gestion du profil utilisateur
  - `useUserPreferences.tsx` : Hook pour la gestion des préférences utilisateur
  - `useUserStatistics.tsx` : Hook pour la gestion des statistiques utilisateur
  - `index.ts` : Exporte tous les hooks

- **utils/** : Fonctions utilitaires spécifiques à la gestion des utilisateurs
  - `userUtils.ts` : Fonctions de formatage, validation, etc.
  - `index.ts` : Exporte toutes les fonctions utilitaires

- **types.ts** : Types TypeScript spécifiques à la gestion des utilisateurs
- **index.ts** : Point d'entrée qui exporte tous les éléments de la fonctionnalité

## Fonctionnalités principales

### Gestion des utilisateurs

- Création, modification et suppression d'utilisateurs
- Recherche et filtrage d'utilisateurs
- Gestion des rôles et des permissions

### Gestion des profils

- Affichage et modification des profils utilisateur
- Gestion des informations personnelles
- Gestion des préférences utilisateur

### Statistiques utilisateur

- Affichage des statistiques utilisateur
- Suivi de l'activité utilisateur
- Génération de rapports

## Utilisation

Pour utiliser cette fonctionnalité dans une page ou un composant :

```tsx
import { UserList, UserProfile } from '../features/users';
import { useUsers, useUserProfile } from '../features/users';

// Utilisation du hook de gestion des utilisateurs
const UsersListPage: React.FC = () => {
  const { users, loading, error, fetchUsers } = useUsers();
  
  return (
    <div>
      <h1>Liste des utilisateurs</h1>
      <UserList users={users} loading={loading} error={error} />
    </div>
  );
};

// Utilisation du hook de gestion du profil utilisateur
const UserProfilePage: React.FC = () => {
  const { userId } = useParams();
  const { user, loading, error, updateUser } = useUserProfile(userId);
  
  if (loading) {
    return <div>Chargement...</div>;
  }
  
  if (error) {
    return <div>Erreur: {error.message}</div>;
  }
  
  return (
    <div>
      <h1>Profil utilisateur</h1>
      <UserProfile user={user} onUpdate={updateUser} />
    </div>
  );
};
```

## Interactions avec d'autres modules

Cette fonctionnalité interagit principalement avec :

- **API Firebase** : Pour la persistance des données
- **Feature d'authentification** : Pour la gestion des utilisateurs authentifiés
- **Feature de planification** : Pour la gestion des assignations de gardes
- **Feature d'échanges directs** : Pour la gestion des échanges de gardes
- **Feature de bourse aux gardes** : Pour la gestion des échanges de gardes
