# Documentation du système de badges

Ce document explique le système de badges utilisé dans les interfaces d'échange et de remplacement de gardes.

## Types d'opérations

Notre système permet 3 types d'opérations fondamentales, représentées par des lettres et des couleurs distinctes:

| Badge | Lettre | Nom | Description |
|-------|--------|-----|-------------|
| 🟢 | **E** | **Échange** | Proposition de permuter une garde avec une autre |
| 🟡 | **C** | **Cession** | Proposition de céder une garde sans en récupérer une autre |
| 🟠 | **R** | **Remplacement** | Proposition d'une garde aux remplaçants |

## Combinaisons d'opérations

Ces opérations peuvent être combinées pour offrir plusieurs options dans une même proposition:

| Badge | Lettres | Combinaison | Description |
|-------|---------|-------------|-------------|
| 🟠 | **CE** | **Cession + Échange** | La garde est proposée à la fois en cession et en échange |
| 🟢 | **ER** | **Échange + Remplacement** | La garde est proposée pour échange ou aux remplaçants |
| 🟠 | **CR** | **Cession + Remplacement** | La garde est proposée en cession ou aux remplaçants |
| 🔵 | **CER** | **Toutes options** | La garde est proposée avec toutes les options (échange, cession et remplacement) |

## Indicateurs de statut

Des indicateurs visuels supplémentaires montrent l'état des propositions:

| Indicateur | Position | Description |
|------------|----------|-------------|
| 🔴 | Coin supérieur droit | Vous avez des propositions en attente de validation pour cette garde |
| 🟡 | Coin supérieur droit | Vous avez reçu des propositions pour cette garde |
| 🔵 | Coin inférieur droit | Vous avez déjà fait une proposition pour cette garde |

## Placement des badges

Le placement des badges suit une logique précise:

- **Gardes de l'utilisateur**: Badge d'opération au coin supérieur gauche, indicateurs de statut au coin supérieur droit
- **Gardes proposées**: Badge d'opération au coin supérieur droit, indicateur de proposition envoyée au coin inférieur droit

## Couleurs et accessibilité

Les couleurs des badges ont été choisies pour être distinctes et offrir un bon contraste. Des tooltips (info-bulles) sont ajoutés sur tous les badges pour améliorer l'accessibilité.

## Tooltips

Tous les badges et indicateurs possèdent des tooltips expliquant leur signification. Pour les voir, il suffit de survoler le badge avec la souris.

## Légende

Une légende complète est disponible en haut du tableau d'échange pour rappeler la signification des différents badges et indicateurs.

## Codes couleur pour les opérations

Les couleurs utilisées pour les badges sont définies dans les fichiers `ThemeColors.css` et `OperationColors.css`:

- **Échange (E)**: Vert clair (`--operation-exchange-bg`)
- **Cession (C)**: Jaune clair (`--operation-give-bg`)
- **Remplacement (R)**: Ambre clair (`--operation-replacement-bg`)
- **Combinaisons**: Chaque combinaison a sa propre couleur distincte