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
| `renderInspector()` | Selon la sélection : `inspectComp`, `inspectWire`, ou fiche de la plaque (nom modifiable, statistiques, liaisons inter-plaques par canal, avec la mention « non relié » si le canal n'existe que sur une plaque). |
| `inspectComp(box, b, c, def)` | Fiche d'une instance : description, étiquette, un champ par clé de `def.props` (type `color` pour `couleur`, `number` si la valeur par défaut est un nombre, sinon texte), pôles avec type et nombre de fils, boutons pivoter / supprimer. Les saisies modifient `c.label` / `c.props` et émettent `change('label' \| 'props')` sans reconstruire la fiche. |
| `inspectWire(box, b, w)` | Fiche d'un fil : extrémités (`Composant.pôle` ou `point libre (x, y)`), couleur (sélecteur libre, bouton `défaut` et pastilles de `App.WIRE_COLORS`), tracé (nombre de points, `+ point de passage` au milieu du tracé, `tracé auto` pour tout effacer), aide sur les gestes, suppression. |
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

### Installation (PWA)

| Élément | Rôle |
|---|---|
| `installPrompt` | Événement `beforeinstallprompt` mis de côté (Chrome, Edge, Android) pour déclencher l'installation au clic. |
| `standalone()` | Vrai si l'app tourne déjà installée (`display-mode: standalone`, ou `navigator.standalone` sur iOS) : le bouton `installer` est alors masqué. |
| `installSteps()` | Instructions HTML selon l'appareil, détecté par le user-agent : iPhone/iPad, Android, Firefox, Safari Mac, ou par défaut Chrome/Edge. |
| `#btnInstall` | Si `installPrompt` existe : fenêtre d'installation native ; refusée ou indisponible : ouvre `#installDialog` avec `installSteps()` et le lien vers le .zip du code. |
| `appinstalled` | Masque le bouton et affiche « application installée ». |
| enregistrement | `navigator.serviceWorker.register('sw.js')` si disponible et hors `file://` ; un échec est ignoré. |

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
| `Entrée` | termine le fil en cours sur le dernier point (`schemaView.endWireHere()`) |
| `Échap` | annule le fil en cours, sinon désélectionne |

## Barre d'outils du schéma

| Élément | Effet |
|---|---|
| menu `fil` (`#newWireColor`) | `App.state.wireColor` : couleur des prochains fils |
| `terminer le fil` (`#btnEndWire`) | `schemaView.endWireHere()` |
| `pivoter`, `supprimer`, `recentrer` | `rotateSelection()`, `deleteSelection()`, `schemaView.fit()` |

## Abonnements

| Événement | Réaction |
|---|---|
| `change` | Liste des plaques ; palette si `library` / `project` ; re-rendu de la vue active ; inspecteur / panneau si `comp`, `wire`, `board` ou `project`. |
| `select` | Re-rendu du schéma et de l'inspecteur. |
| `project` | Nom du projet, palette, oubli des cadrages (`views = {}`), rechargement du JSON. |
| `sim` | Si l'onglet Simulateur est ouvert : re-rendu du schéma **seulement si** `Sim.changed` ou `simView.animated` (grands circuits), puis `updateSimPanel()`. |
| `simstate` | Boutons ▶/■, panneau, re-rendu du simulateur. |
| `resize` (fenêtre) | `applyView()` de la vue de schéma active. |

## Démarrage

1. Création de `App.schemaView` et `App.simView`.
2. Lecture de la sauvegarde locale ; si elle est absente ou invalide (`normalizeProject` lève une erreur), on charge le projet de démo.
3. `App.setProject(…)` puis `App.showTab('schema')`.
