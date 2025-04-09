# Feature d'Authentification

Cette fonctionnalité gère l'authentification des utilisateurs, les inscriptions, les connexions et les autorisations.

## Structure du dossier

La fonctionnalité est organisée selon une architecture orientée feature, avec les sous-dossiers suivants :

- **components/** : Composants React spécifiques à l'authentification
  - `LoginForm.tsx` : Formulaire de connexion
  - `RegisterForm.tsx` : Formulaire d'inscription
  - `PasswordResetForm.tsx` : Formulaire de réinitialisation de mot de passe
  - `ProtectedRoute.tsx` : Composant de route protégée
  - `index.ts` : Exporte tous les composants

- **hooks/** : Hooks React spécifiques à l'authentification
  - `useAuth.ts` : Hook principal d'authentification
  - `useAuthState.ts` : Hook pour l'état d'authentification
  - `usePermissions.ts` : Hook pour la gestion des permissions
  - `index.ts` : Exporte tous les hooks

- **utils/** : Fonctions utilitaires spécifiques à l'authentification
  - `authUtils.ts` : Fonctions de validation, formatage, etc.
  - `index.ts` : Exporte toutes les fonctions utilitaires

- **types.ts** : Types TypeScript spécifiques à l'authentification
- **index.ts** : Point d'entrée qui exporte tous les éléments de la fonctionnalité

## Fonctionnalités principales

### Authentification

- Connexion par email/mot de passe
- Inscription de nouveaux utilisateurs
- Déconnexion
- Réinitialisation de mot de passe
- Persistance de session

### Gestion des utilisateurs

- Récupération des informations utilisateur
- Mise à jour du profil utilisateur
- Gestion des rôles et permissions

### Sécurité

- Protection des routes
- Vérification des permissions
- Gestion des tokens d'authentification

## Utilisation

Pour utiliser cette fonctionnalité dans une page ou un composant :

```tsx
import { LoginForm, ProtectedRoute } from '../features/auth';
import { useAuth } from '../features/auth';

// Utilisation du hook d'authentification
const AuthComponent: React.FC = () => {
  const { user, login, logout, isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <div>Chargement...</div>;
  }
  
  return (
    <div>
      {isAuthenticated ? (
        <div>
          <p>Bienvenue, {user?.displayName}</p>
          <button onClick={logout}>Déconnexion</button>
        </div>
      ) : (
        <LoginForm onLogin={login} />
      )}
    </div>
  );
};

// Utilisation du composant de route protégée
const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
};
```

## Interactions avec d'autres modules

Cette fonctionnalité interagit principalement avec :

- **API Firebase** : Pour l'authentification et la gestion des utilisateurs
- **Context utilisateur** : Pour partager l'état d'authentification dans l'application
- **Feature de gestion des utilisateurs** : Pour la gestion des profils utilisateurs
