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
| `pending` | Départ du fil en cours : pôle `{ c, p }`, point libre `{ x, y }`, ou `null`. |
| `via` | Points de passage `[[x, y], …]` posés pendant le câblage en cours. |
| `ghost` | Dernière position du pointeur pour le fil « fantôme ». |
| `motorAngle` | Angles des moteurs (animation 2D). |
| `animated` | Vrai si un moteur tourne sur la plaque affichée : la vue doit être redessinée à chaque image même si `Sim.changed` est faux. |
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
2. Fils : tracé visible (couleur `wire.color` en style inline, classe `colored`) + tracé large transparent cliquable (`data-wire`). En mode `sim`, classe `on` / `off` / `float` selon `Sim.wireValue` (un fil coloré est estompé à `off` / `float`) et infobulle avec la tension (et « conflit »).
3. Extrémités libres : un carré `data-pt="x,y"` par point ; un point plein (`junction`) si plusieurs extrémités s'y rejoignent.
3 bis. Si `App.prefs.showLinks` ou si un canal est isolé : liaisons entre connecteurs (`drawLinks`), traits sous les composants, étiquettes au-dessus.
3 ter. Canal isolé (`App.state.focusCanal`) : les fils du nœud du canal (`Sim.canalNet`) reçoivent la classe `focus`, les autres `dim` ; les composants sans aucun pôle sur ce nœud reçoivent `dim`.
4. Composants via `App.drawComponent`. Une instance de type inconnu est affichée `? type` en rouge. En mode `sim`, une erreur d'exécution est affichée au-dessus (`⚠ message`).
5. Poignées du fil sélectionné (mode édition) : ronds `data-via="filId|index"` pour les points de passage, carrés `data-end="filId|a|b"` pour les extrémités libres.
6. Calque du fil fantôme.

### `view.drawGhost(pt)`
Dessine le fil en cours en pointillés (couleur `App.state.wireColor`) : de `pending`, par les points `via` (marqués), jusqu'au point `pt` aimanté.

### `view.startWire(end)`
Commence un fil depuis un pôle ou un point libre (vide `via`).

### `view.finishWire(end) → fil | null`
Termine le fil en cours sur `end` avec les points `via` et la couleur courante (`App.addWire`), sélectionne le fil créé et remet le câblage à zéro.

### `view.endWireHere() → boolean`
Termine le fil sur son **dernier point de passage**, qui devient une extrémité libre (bouton `terminer le fil`, touche `Entrée`). Affiche un message s'il n'y a encore aucun point.

### `view.addVia(pt)`
Ajoute un point de passage aimanté (ignoré s'il est identique au précédent) et redessine le fantôme.

### `view.handleDouble(e) → boolean`
Traite un double-clic en mode édition. Retourne `true` si le geste a été utilisé :
- câblage en cours, hors pôle / extrémité libre : retire les points identiques posés par les deux clics, puis termine le fil en extrémité libre à cet endroit ;
- sur un point de passage : le retire (et supprime `pts` s'il devient vide) ;
- sur un fil : ajoute un point de passage (`App.addViaPoint`) et sélectionne le fil.

L'élément visé est relu avec `document.elementFromPoint`, car le premier clic a pu re-dessiner le SVG.

### `view.bind()` *(appelée par le constructeur)*
Pose les gestionnaires d'événements sur le SVG :

| Geste | Mode | Effet |
|---|---|---|
| molette | tous | `zoomAt` ×1,15 / ÷1,15 sous le pointeur |
| 2 doigts | tous | pincement = zoom |
| clic sur un connecteur | sim | isole son canal, ou réaffiche tout si c'était déjà le canal isolé (en édition, c'est la sélection qui isole : voir [API app.js](API-app)) |
| clic dans le vide | sim | réaffiche tout (`App.setFocusCanal(null)`) |
| clic sur une étiquette de liaison (`data-goto`) | tous | annule le fil en cours et ouvre la plaque indiquée (`App.selectBoard`) |
| 2 appuis < 400 ms et < 6 px | edit | double-clic : `handleDouble` (détection maison, le navigateur n'émet pas `dblclick` quand le SVG est re-dessiné entre deux clics) |
| appui sur une poignée du fil sélectionné | edit | glisser un point de passage ou une extrémité libre ; au relâchement, une extrémité près d'un pôle (8 px) s'y branche (`App.pinNear`) ; `change('wire')` |
| clic pôle ou carré d'extrémité libre | edit | sans fil en cours : `startWire` ; sinon `finishWire` |
| clic ailleurs avec un fil en cours | edit | pose un point de passage (`addVia`) ; un glisser déplace la vue sans annuler |
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

## Fonctions publiques ajoutées à `App`

### `App.addViaPoint(board, wire, p)`
Voir [API model.js](API-model#appaddviapointboard-wire-p-défini-dans-schematicjs).

## Fonctions privées

### `el(tag, attrs, parent) → SVGElement`
Crée un élément SVG avec ses attributs et l'ajoute à `parent`.

### `fmtV(v) → string`
`'2.50 V'`, ou `'Z (flottant)'` pour `null`.

### `drawLinks(lines, tags, b, sim, focus)`
Pour chaque canal présent sur la plaque `b` (seulement `focus` s'il est défini) :
1. relie ses connecteurs en pointillés (`link-line`, couleur `App.channelColor`) selon un **arbre couvrant minimal** (algorithme de Prim : chaque connecteur est relié au plus proche de ceux déjà reliés) ; en mode `sim`, classe `on` / `off` / `float` selon la tension du canal ;
2. si le canal existe sur d'autres plaques, écrit sous chaque connecteur `→ Plaque1, Plaque2 (+n)` (`link-tag`, infobulle avec la liste complète) ; `data-goto` désigne la plaque suivante dans l'ordre des plaques, en revenant au début.

### `sliderValue(comp, def, pt) → number`
Position 0..1 du pointeur sur la glissière (toujours dessinée à l'horizontale, centrée, largeur affichée − 16 px). Non bornée : `Sim.interact` s'en charge.
