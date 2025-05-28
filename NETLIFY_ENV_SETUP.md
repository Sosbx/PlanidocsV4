# Configuration des Variables d'Environnement sur Netlify

## Variables Firebase Requises

Pour déployer Planidocs sur Netlify, vous devez configurer les variables d'environnement suivantes dans le dashboard Netlify :

### 1. Accédez aux paramètres Netlify
1. Connectez-vous à [Netlify](https://app.netlify.com)
2. Sélectionnez votre site Planidocs
3. Allez dans **Site settings** → **Environment variables**

### 2. Ajoutez les variables Firebase

Créez les variables suivantes avec les valeurs de votre projet Firebase :

```
VITE_FIREBASE_API_KEY=AIzaSyC59Syrl04sY7E1zmJW_jFs1m5I7rHORB4
VITE_FIREBASE_AUTH_DOMAIN=planego-696d3.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=planego-696d3
VITE_FIREBASE_STORAGE_BUCKET=planego-696d3.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=688748545967
VITE_FIREBASE_APP_ID=1:688748545967:web:1f241fc72beafe9ed3915a
```

### 3. Variables supplémentaires recommandées

```
# Region des Cloud Functions
VITE_FIREBASE_FUNCTIONS_REGION=europe-west1

# Emails administrateurs (optionnel - peut être géré dans le code)
VITE_ADMIN_EMAIL_RD=secretariatrd@h24scm.com
VITE_ADMIN_EMAIL_RG=secretariat.rive-gauche@h24scm.com
```

### 4. Mise à jour du code Firebase config

Pour utiliser les variables d'environnement, modifiez `src/lib/firebase/config.ts` :

```typescript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC59Syrl04sY7E1zmJW_jFs1m5I7rHORB4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "planego-696d3.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "planego-696d3",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "planego-696d3.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "688748545967",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:688748545967:web:1f241fc72beafe9ed3915a"
};
```

### 5. Sécurité

⚠️ **Important** : 
- Ne jamais commiter les vraies clés API dans le code
- Utilisez des variables d'environnement différentes pour dev/staging/production
- Configurez les règles de sécurité Firebase appropriées
- Limitez les domaines autorisés dans Firebase Console

### 6. Redéploiement

Après avoir ajouté les variables d'environnement :
1. Déclenchez un nouveau déploiement dans Netlify
2. Les variables seront automatiquement disponibles lors du build

### 7. Vérification

Pour vérifier que les variables sont bien configurées :
- Vérifiez les logs de build dans Netlify
- Testez l'authentification et les fonctionnalités Firebase après déploiement