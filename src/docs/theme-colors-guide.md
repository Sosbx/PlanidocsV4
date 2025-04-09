# Guide des couleurs et styles

Ce document explique comment utiliser les styles centralisés dans le projet.

## Structure des fichiers

- `ThemeColors.css` : Contient toutes les variables de couleurs du site
- `BadgeStyles.css` : Contient les styles pour les badges et éléments visuels

## Utilisation des couleurs

Pour utiliser les couleurs définies dans `ThemeColors.css`, importez le fichier et utilisez les variables CSS :

```css
@import '../styles/ThemeColors.css';

.my-component {
  background-color: var(--period-morning-bg);
  color: var(--period-morning-text);
}
```

## Utilisation des badges

Pour utiliser les styles de badges définis dans `BadgeStyles.css`, importez le fichier et utilisez les classes CSS :

```jsx
import '../styles/BadgeStyles.css';

const MyComponent = () => (
  <div className="badge-morning">
    Matin
  </div>
);
```

## Classes disponibles

### Périodes

- Matin (M) : `badge-morning`, `shift-badge-morning`, `header-morning`
- Après-midi (AM) : `badge-afternoon`, `shift-badge-afternoon`, `header-afternoon`
- Soir (S) : `badge-evening`, `shift-badge-evening`, `header-evening`

### États

- Intéressé : `badge-interested`, `shift-badge-interested`
- Conflit : `badge-conflict`, `shift-badge-conflict`
- Remplacement : `badge-replacement`, `shift-badge-replacement`

### Options d'échange

- Échange : `btn-exchange`
- Cession : `btn-give`
- Remplaçants : `btn-replacement-option`
- Option inactive : `btn-option-inactive`

### Désidératas

- Primaire : `desiderata-primary`
- Secondaire : `desiderata-secondary`

### Animations

- Ripple : `badge-ripple`
- Remove Interest : `badge-remove-interest`

## Modification des couleurs

Pour modifier les couleurs du site, modifiez uniquement le fichier `ThemeColors.css`. Toutes les couleurs sont définies comme variables CSS dans ce fichier.

### Exemple de modification

Si vous souhaitez modifier la couleur de fond des badges de matin, modifiez la variable `--period-morning-bg` dans `ThemeColors.css` :

```css
:root {
  /* Couleurs des périodes */
  --period-morning-bg: #E6F0FA; /* Modifiez cette valeur */
  --period-morning-text: #4A95D6;
  --period-morning-border: #7CB9E8;
  --period-morning-hover: #D6EBFF;
  --period-morning-ring: rgba(76, 149, 214, 0.3);
  
  /* ... autres variables ... */
}
```

## Avantages de cette approche

1. **Centralisation** : Toutes les couleurs sont définies à un seul endroit
2. **Cohérence** : Les mêmes couleurs sont utilisées partout dans le site
3. **Maintenabilité** : Pour changer une couleur, il suffit de modifier la variable CSS correspondante
4. **Séparation des préoccupations** : Les couleurs sont séparées des styles de forme et d'animation
