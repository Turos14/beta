# API — `js/app.js`

Contrôleur de l'interface, chargé en dernier : onglets, liste des plaques, palette,
inspecteur, panneau du simulateur, import / export, raccourcis, démarrage.

## Fonctions publiques

### `App.toast(msg, err)`
Affiche un message temporaire (2,2 s) en bas de l'écran, en rouge si `err` est vrai.

### `App.showTab(name)`
Affiche l'onglet `schema`, `library`, `view3d`, `sim` ou `json` :
- la palette n'est visible que dans *Schéma* ; la colonne des plaques est masquée dans *Composants* et *JSON* ;
- `View3D.show()` / `hide()` selon l'onglet ;
- rendu de la vue concernée (schéma + inspecteur, simulateur + panneau, éditeur de composants, JSON).

### `App.schemaView`, `App.simView`
Les deux instances de [`App.SchematicView`](API-schematic) (`#schemaSvg` en édition, `#simSvg` en simulation).

## Fonctions privées

### Plaques

| Fonction | Rôle |
|---|---|
| `renderBoards()` | Liste des plaques : nom, nombre de composants, boutons `↑` (sauf la première), `✎`, `×`. |
| `selectBoard(id)` | Change de plaque, vide la sélection, annule le fil en cours, re-dessine la vue active. |
| `renameBoard(b)` | Demande un nouveau nom (`prompt`) et l'applique s'il n'est pas vide. |

Clic sur la liste : `×` supprime (confirmation, refusé s'il ne reste qu'une plaque), `✎` renomme, `↑` remonte la plaque (ordre d'empilement en 3D), ailleurs sélectionne. Double-clic : renommer.

### Palette

| Fonction | Rôle |
|---|---|
| `renderPalette()` | Composants de la bibliothèque groupés par catégorie, avec la description en infobulle, déplaçables (`draggable`). |

Clic : `schemaView.addAt(type)` au centre. Glisser : le type passe dans `dataTransfer` et la vue le dépose sous le pointeur.

### Inspecteur (onglet Schéma)

| Fonction | Rôle |
|---|---|
| `renderInspector()` | Selon la sélection : `inspectComp`, fiche du fil (extrémités + supprimer), ou fiche de la plaque (nom modifiable, statistiques, liaisons inter-plaques par canal, avec la mention « non relié » si le canal n'existe que sur une plaque). |
| `inspectComp(box, b, c, def)` | Fiche d'une instance : description, étiquette, un champ par clé de `def.props` (type `color` pour `couleur`, `number` si la valeur par défaut est un nombre, sinon texte), pôles avec type et nombre de fils, boutons pivoter / supprimer. Les saisies modifient `c.label` / `c.props` et émettent `change('label' \| 'props')` sans reconstruire la fiche. |
| `deleteSelection()` | Supprime le composant (avec ses fils) ou le fil sélectionné, puis vide la sélection. |
| `rotateSelection()` | Pivote le composant sélectionné de +90°. |

### Panneau du simulateur

| Fonction | Rôle |
|---|---|
| `renderSimPanel()` | Construit, pour **toutes** les plaques, une ligne par composant interactif ou afficheur : bouton ON/OFF (`switch`), bouton à maintenir (`button`), curseur (`slider`), et une zone de lecture. Puis la zone *Erreurs* et la légende des couleurs. |
| `updateSimPanel()` | Mise à jour **sur place** (sans reconstruire, pour ne pas interrompre un glisser) : état des boutons, position des curseurs (sauf celui qu'on manipule), lectures (`state.text`, ou allumée / éteinte), erreurs, statut `en cours · t = …`. |
| `updateSimButtons()` | Libellé et style des boutons `▶ simuler` / `■ arrêter` (simulateur et 3D). |

### Import / export

| Fonction | Rôle |
|---|---|
| `download()` | Télécharge le projet indenté dans `<nom>.json` (caractères spéciaux du nom remplacés par `_`). |

- `importer` : ouvre le sélecteur de fichier, lit le fichier, arrête la simulation, puis `App.setProject(JSON.parse(…))`. En cas d'erreur, toast rouge avec le message.
- `nouveau` : demande « vide » ou « demo » (`prompt`), puis charge `emptyProject()` ou `demoProject()`.
- Nom du projet : la saisie met à jour `project.name` (`change('name')`).

### Utilitaires

| Fonction | Rôle |
|---|---|
| `$(id)` | `document.getElementById`. |
| `esc(s)` | Échappement HTML. |

## Raccourcis clavier (onglet Schéma, hors champ de saisie)

| Touche | Action |
|---|---|
| `Suppr`, `Retour arrière` | `deleteSelection()` |
| `R` | `rotateSelection()` |
| `Échap` | annule le fil en cours, sinon désélectionne |

## Abonnements

| Événement | Réaction |
|---|---|
| `change` | Liste des plaques ; palette si `library` / `project` ; re-rendu de la vue active ; inspecteur / panneau si `comp`, `wire`, `board` ou `project`. |
| `select` | Re-rendu du schéma et de l'inspecteur. |
| `project` | Nom du projet, palette, oubli des cadrages (`views = {}`), rechargement du JSON. |
| `sim` | Si l'onglet Simulateur est ouvert : re-rendu du schéma et `updateSimPanel()`. |
| `simstate` | Boutons ▶/■, panneau, re-rendu du simulateur. |
| `resize` (fenêtre) | `applyView()` de la vue de schéma active. |

## Démarrage

1. Création de `App.schemaView` et `App.simView`.
2. Lecture de la sauvegarde locale ; si elle est absente ou invalide (`normalizeProject` lève une erreur), on charge le projet de démo.
3. `App.setProject(…)` puis `App.showTab('schema')`.
