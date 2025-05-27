# Statut Remplaçant - Documentation

Ce document explique le fonctionnement du statut de remplaçant dans l'application.

## Fonctionnalité Remplaçant

Le statut de remplaçant permet à certains utilisateurs (typiquement des médecins remplaçants) de recevoir et de répondre à des propositions de remplacement pour des gardes, distinctement des propositions d'échange ou de cession.

## Configuration du statut Remplaçant

### Pour les administrateurs

1. Accédez à la page **Gestion des Utilisateurs** via le menu principal
2. Pour modifier un utilisateur existant:
   - Cliquez sur l'icône ⚙️ (paramètres) à côté de l'utilisateur
   - Cochez l'option **Remplaçant** dans la liste des rôles
   - Cliquez sur **Enregistrer**

3. Pour ajouter un nouvel utilisateur avec le statut de remplaçant:
   - Créez d'abord l'utilisateur normalement
   - Puis modifiez ses rôles comme indiqué ci-dessus

### Identification visuelle

Les utilisateurs ayant le statut de remplaçant sont identifiés par:
- Un badge "Remplaçant" de couleur ambre dans la liste des utilisateurs
- Des indicateurs spécifiques dans l'interface d'échange de gardes

## Fonctionnement des gardes pour remplaçants

### Proposer des gardes aux remplaçants

Lorsqu'un médecin propose une garde en mode "Remplacement":
- Seuls les utilisateurs ayant le statut de remplaçant verront cette garde
- La garde est marquée d'un badge "R" de couleur ambre

### Combinaison avec d'autres types d'opérations

Le type d'opération "Remplacement" peut être combiné avec:
- Échange (ER): visible par les utilisateurs standard ET les remplaçants
- Cession (CR): visible par les utilisateurs standard ET les remplaçants
- Les deux (CER): visible par tous les utilisateurs avec toutes les options disponibles

## Workflow pour les remplaçants

1. Les utilisateurs avec statut "Remplaçant" se connectent à l'application
2. Ils accèdent à l'interface d'échange de gardes
3. Ils peuvent voir:
   - Les gardes proposées uniquement aux remplaçants (badge "R")
   - Les gardes proposées à tous les utilisateurs (badges "ER", "CR", "CER")
4. Ils peuvent faire des propositions de remplacement
5. Leurs propositions sont traitées de manière spécifique, distincte des échanges

## Considérations techniques

- Le filtre des gardes proposées tient compte du statut remplaçant
- L'interface adapte son affichage en fonction du statut de l'utilisateur
- Les notifications sont envoyées de manière ciblée aux remplaçants pour les gardes qui les concernent

## Limitations actuelles

- Le statut de remplaçant est binaire (activé/désactivé)
- Il n'y a pas de sous-catégories de remplaçants
- Le remplaçant ne peut pas spécifier ses préférences de périodes ou de sites

## Évolutions futures

- Ajout de préférences pour les remplaçants (périodes, sites, fréquence)
- Système de notation pour les remplacements effectués
- Historique dédié des remplacements effectués