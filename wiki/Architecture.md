# Architecture

Application 100 % statique : aucun bundler, aucun framework. Les scripts sont des fichiers
JavaScript classiques chargés dans l'ordre par `index.html`. Ils partagent un unique
espace de noms global : **`window.App`**.

## Arborescence

```
index.html                 structure de la page (onglets, vues, panneaux)
css/style.css              thème noir / vert, police de VS Code, responsive
js/library.js              App.DEFAULT_LIBRARY : composants par défaut
js/model.js                projet, événements, géométrie, sauvegarde
js/sim.js                  App.Sim : simulateur
js/schematic.js            App.SchematicView : rendu / édition SVG, App.drawComponent
js/library-editor.js       App.LibraryEditor : éditeur de composants
js/view3d.js               App.View3D : vue 3D (Three.js)
js/json-editor.js          App.JsonEditor : édition JSON
js/app.js                  contrôleur : onglets, plaques, palette, inspecteur, panneau, import/export
.github/workflows/pages.yml  vérification + déploiement GitHub Pages
.github/workflows/wiki.yml   synchronisation du dossier wiki/ vers le wiki GitHub
wiki/                      ce wiki
```

## Ordre de chargement

```
three.min.js (r128, cdnjs)  →  OrbitControls.js (jsdelivr)
library.js → model.js → sim.js → schematic.js → library-editor.js → view3d.js → json-editor.js → app.js
```

Chaque fichier (sauf `library.js`) est encapsulé dans une IIFE `(function () { … })();` :
les fonctions internes restent privées, seules les propriétés ajoutées à `App` sont publiques.
`app.js` est chargé en dernier et lance l'application (voir [API app.js](API-app)).

## Modules publics

| Objet | Fichier | Rôle |
|---|---|---|
| `App` (fonctions racine) | model.js, schematic.js, library-editor.js, app.js | Modèle, géométrie, utilitaires, notifications |
| `App.Sim` | sim.js | Simulation |
| `App.SchematicView` | schematic.js | Classe de vue SVG ; deux instances : `App.schemaView` (édition), `App.simView` (simulation) |
| `App.LibraryEditor` | library-editor.js | Onglet Composants |
| `App.View3D` | view3d.js | Onglet Vue 3D |
| `App.JsonEditor` | json-editor.js | Onglet JSON |

## État global

| Variable | Contenu |
|---|---|
| `App.project` | Le projet courant (voir [Format du projet JSON](Format-du-projet-JSON)). |
| `App.state.boardId` | Id de la plaque (schéma) affichée. |
| `App.state.selection` | `null`, `{ kind: 'comp', id }` ou `{ kind: 'wire', id }` dans l'éditeur. |
| `App.Sim.*` | État de la simulation (temps, contrôles, mémoire, nœuds, tensions). |

## Bus d'événements

`App.on(nom, fn)` abonne une fonction, `App.emit(nom, données)` la déclenche.

| Événement | Émis par | Donnée | Abonnés |
|---|---|---|---|
| `change` | `App.changed(raison)` après toute modification du projet | raison (chaîne) | app.js (rafraîchit listes et vues), sim.js (reconstruit les nœuds), view3d.js (reconstruit la scène) |
| `project` | `App.setProject` (nouveau projet chargé) | — | app.js (nom, palette, vues, JSON), view3d.js (reconstruit et recadre) |
| `select` | éditeur de schéma, inspecteur | — | app.js (re-dessine le schéma et l'inspecteur) |
| `sim` | `Sim` à chaque pas, réinitialisation ou interaction | — | app.js (vue simulateur + panneau), view3d.js (demande une image) |
| `simstate` | `Sim.start` / `Sim.stop` | — | app.js (boutons ▶/■, panneau), view3d.js |

### Raisons de `change`

`project`, `board`, `comp`, `wire`, `move`, `rotate`, `label`, `props`, `library`, `name`.
Selon la raison, `app.js` re-dessine plus ou moins de choses : par exemple la palette
n'est reconstruite que pour `library` et `project`, et l'inspecteur n'est **pas**
reconstruit pendant qu'on tape dedans (`label`, `props`) pour ne pas perdre le focus.

## Flux de données

```
            ┌──────────── interaction utilisateur ────────────┐
            ▼                                                 │
   modification de App.project ──► App.changed(raison)        │
                                     │  ├─► emit('change') ──► vues 2D / 3D / listes
                                     │  │                   └► Sim.dirty = true (+ evaluate si arrêté)
                                     │  └─► saveLocal() après 300 ms (localStorage)
                                     ▼
   Sim (boucle requestAnimationFrame) ── evaluate() ──► emit('sim') ──► rendu simulateur, 3D
```

Les vues ne gardent aucune copie du projet : elles le relisent entièrement à chaque rendu
(le SVG est reconstruit, la scène 3D est reconstruite quand elle est visible).

## Coordonnées

- **Schéma** : pixels SVG, axe Y vers le bas. Les composants sont aimantés sur une grille
  de 10 px (`App.GRID`), les pôles sont espacés de 20 px. `comp.x/comp.y` = coin
  supérieur gauche du composant **non pivoté** ; la rotation (0/90/180/270°, sens horaire)
  se fait autour de son centre.
- **3D** : 1 unité = 20 px (`S = 1/20`). Le point schéma `(x, y)` devient `(x, hauteur, y)`
  relativement au centre de la plaque ; une rotation schéma `θ` devient `rotation.y = −θ`.

## Choix techniques

- **Pas de build** : on ouvre `index.html` via n'importe quel serveur statique ; GitHub Pages suffit.
- **Programmes des composants en JS** compilés avec `new Function` : le code s'exécute dans
  la page, avec les mêmes droits qu'elle. N'importer que des projets de confiance.
- **Rendu SVG reconstruit** à chaque changement : simple et suffisant pour des schémas de
  quelques centaines d'éléments. Les gestionnaires d'événements sont posés sur le `<svg>`
  (délégation via `data-comp`, `data-pin`, `data-wire`), ils survivent donc aux re-rendus.
