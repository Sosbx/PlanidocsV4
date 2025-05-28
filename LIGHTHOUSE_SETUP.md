# Configuration du Plugin Lighthouse sur Netlify

## État actuel ✅

Le plugin Lighthouse est **déjà configuré** dans `netlify.toml` :

```toml
[[plugins]]
  package = "@netlify/plugin-lighthouse"
  
  [plugins.inputs]
    output_path = "reports/lighthouse.html"
```

## Activation et utilisation

### 1. Activation automatique
Le plugin sera automatiquement installé et exécuté lors du prochain déploiement sur Netlify.

### 2. Rapports générés
- Les rapports Lighthouse seront générés à chaque build
- Accessibles dans : `reports/lighthouse.html`
- Visibles dans le dashboard Netlify après déploiement

### 3. Configuration avancée (optionnelle)

Pour personnaliser les audits Lighthouse, vous pouvez modifier `netlify.toml` :

```toml
[[plugins]]
  package = "@netlify/plugin-lighthouse"
  
  [plugins.inputs]
    output_path = "reports/lighthouse.html"
    # Seuils de performance minimums
    thresholds.performance = 0.9
    thresholds.accessibility = 0.9
    thresholds.best-practices = 0.9
    thresholds.seo = 0.9
    
    # URLs à auditer (par défaut: page d'accueil)
    audits = [
      { url = "/", title = "Page d'accueil" },
      { url = "/planning", title = "Planning" },
      { url = "/exchange", title = "Échanges" }
    ]
```

### 4. Visualisation des résultats

#### Dans Netlify :
1. Après déploiement, allez dans **Deploy summary**
2. Cherchez la section **Plugin: Lighthouse**
3. Cliquez sur le lien du rapport

#### En local (après déploiement) :
- Le rapport HTML est accessible à : `https://votre-site.netlify.app/reports/lighthouse.html`

### 5. Métriques surveillées

Le plugin Lighthouse mesure :
- **Performance** : Vitesse de chargement, interactivité
- **Accessibilité** : Conformité aux standards d'accessibilité
- **Best Practices** : Bonnes pratiques web
- **SEO** : Optimisation pour les moteurs de recherche
- **PWA** : Capacités Progressive Web App

### 6. Optimisations recommandées pour Planidocs

Basé sur la structure actuelle :

1. **Performance** :
   - ✅ Code splitting déjà en place (lazy loading)
   - ✅ Assets mis en cache (configuré dans netlify.toml)
   - ⚠️ Considérer l'optimisation des chunks > 1MB

2. **Accessibilité** :
   - Ajouter des attributs ARIA sur les composants interactifs
   - Vérifier les contrastes de couleurs

3. **SEO** :
   - Ajouter des meta descriptions
   - Implémenter un sitemap.xml

### 7. Intégration CI/CD

Pour bloquer les déploiements si les scores sont trop bas :

```toml
[plugins.inputs]
  fail_deploy_on_score_thresholds = true
  thresholds.performance = 0.8
```

### 8. Notifications

Pour recevoir des alertes sur les performances :
1. Dans Netlify → **Site settings** → **Build & deploy** → **Deploy notifications**
2. Ajoutez une notification pour "Deploy failed"
3. Les échecs Lighthouse déclencheront des alertes