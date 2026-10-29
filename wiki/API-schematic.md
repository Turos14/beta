# API — `js/schematic.js`

Rendu SVG des composants et vue de schéma interactive (édition et simulation).

## Fonctions publiques

### `App.hexA(hex, a) → string`
Convertit une couleur `#rgb` / `#rrggbb` en `rgba(r,g,b,a)`. Couleur invalide : vert du thème.

### `App.drawComponent(parent, comp, def, opts) → SVGGElement`
Dessine une instance dans `parent` et retourne le groupe `<g class="comp" data-comp="id">`. Sert aux deux vues de schéma et à l'aperçu de l'éditeur de composants.

| Option `opts` | Type | Effet |
|---|---|---|
| `mode` | `'edit'` \| `'sim'` | En `sim`, les composants interactifs ont un curseur « main ». |
| `selected` | boolean | Contour accentué. |
| `pending` | `{ c, p }` | Pôle de départ d'un fil en cours (pastille allumée). |
| `state` | object | `state` de l'instance (voyant, texte, vitesse). |
| `ui` | object | État du contrôle (ON/OFF, bouton enfoncé, position du curseur). |
| `angle` | number | Angle actuel de l'indicateur moteur (rad). |
| `pinValue` | `(pin) => number \| null` | Ajoute la tension à l'infobulle de chaque pôle. |
| `noPinNames` | boolean | Masque les noms de pôles. |

Contenu dessiné :
1. Corps : rectangle pivoté autour du centre, couleur `def.color` (coins arrondis pour le connecteur).
2. Centre, selon `display` puis `interactive` : voyant (`led`), texte (`value`), indicateur rotatif (`motor`), `ON`/`OFF` (`switch`), carré enfoncé (`button`), glissière (`slider`), nom du canal (connecteur), sinon nom de la définition (tronqué à 10 caractères).
3. Étiquette au-dessus (`comp.label` ou nom), toujours horizontale.
4. Pôles : nom (sauf connecteur) et pastille `data-pin="compId|pôle"` avec infobulle `nom (type)`.

## Classe `App.SchematicView`

```js
const view = new App.SchematicView(svgElement, 'edit' | 'sim');
```

| Propriété | Description |
|---|---|
| `svg` | Élément `<svg>` géré. |
| `mode` | `'edit'` ou `'sim'`. |
| `views` | `{ [boardId]: { x, y, scale, fitted } }` : cadrage mémorisé par plaque. |
| `pending` | Pôle de départ du fil en cours (`{ c, p }`) ou `null`. |
| `ghost` | Dernière position du pointeur pour le fil « fantôme ». |
| `motorAngle` | Angles des moteurs (animation 2D). |
| `ghostLayer` | Calque SVG du fil fantôme. |

### `view.view() → { x, y, scale, fitted }`
Cadrage de la plaque courante, créé (`scale` 1,5, non recadré) s'il n'existe pas.

### `view.applyView()`
Applique le cadrage via l'attribut `viewBox`, en fonction de la taille affichée du SVG.

### `view.toWorld(clientX, clientY) → { x, y }`
Convertit des coordonnées écran (pointeur) en coordonnées du schéma.

### `view.fit()`
Recadre sur `App.boardBounds` avec 40 px de marge, zoom borné entre 0,3 et 3. Sans effet tant que le SVG n'a pas de taille (onglet masqué) ; le recadrage est alors fait au premier `render()` visible (`fitted: false`).

### `view.render()`
Reconstruit tout le SVG :
1. Motif de grille (points tous les 10 px) sur un grand rectangle de fond (`data-bg`).
2. Fils : tracé visible + tracé large transparent cliquable (`data-wire`). En mode `sim`, classe `on` / `off` / `float` selon la tension et infobulle avec la tension (et « conflit »).
3. Composants via `App.drawComponent`. Une instance de type inconnu est affichée `? type` en rouge. En mode `sim`, une erreur d'exécution est affichée au-dessus (`⚠ message`).
4. Calque du fil fantôme.

### `view.drawGhost(pt)`
Dessine le fil en pointillés entre le pôle `pending` et le point `pt`.

### `view.bind()` *(appelée par le constructeur)*
Pose les gestionnaires d'événements sur le SVG :

| Geste | Mode | Effet |
|---|---|---|
| molette | tous | `zoomAt` ×1,15 / ÷1,15 sous le pointeur |
| 2 doigts | tous | pincement = zoom |
| clic pôle | edit | 1er clic : début de fil ; 2e clic : `App.addWire` |
| clic ailleurs avec un fil en cours | edit | annule le fil |
| appui composant | edit | sélection + déplacement aimanté (`change('move')` au relâchement) |
| appui composant | sim | `switch` : bascule ; `button` : appuyé jusqu'au relâchement ; `slider` : position selon le pointeur, suivie pendant le glisser |
| clic fil | edit | sélection du fil |
| glisser le fond | tous | déplacement de la vue ; un simple clic désélectionne (edit) |
| déposer depuis la palette | edit | `addAt(type, position)` |

### `view.addAt(type, pt)`
Ajoute une instance centrée sur `pt` (par défaut le centre de la vue) et la sélectionne.

### `view.zoomAt(clientX, clientY, factor)`
Zoome d'un facteur `factor` (échelle bornée entre 0,2 et 6) en gardant fixe le point sous le pointeur.

### `view.cancelWire() → boolean`
Annule le fil en cours. Retourne `true` s'il y en avait un (utilisé par `Échap`).

## Fonctions privées

### `el(tag, attrs, parent) → SVGElement`
Crée un élément SVG avec ses attributs et l'ajoute à `parent`.

### `fmtV(v) → string`
`'2.50 V'`, ou `'Z (flottant)'` pour `null`.

### `sliderValue(comp, def, pt) → number`
Position 0..1 du pointeur sur la glissière (toujours dessinée à l'horizontale, centrée, largeur affichée − 16 px). Non bornée : `Sim.interact` s'en charge.
