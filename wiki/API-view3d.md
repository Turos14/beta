# API — `js/view3d.js`

Vue 3D avec Three.js r128 + OrbitControls. Objet public : **`App.View3D`** (alias interne `V3`).

## Constantes

| Nom | Valeur | Description |
|---|---|---|
| `S` | `1/20` | Échelle : 20 px de schéma = 1 unité 3D. |
| `BOARD_T` | `0.12` | Épaisseur d'une plaque. |
| `STACK_GAP` | `3.2` | Écart vertical entre plaques empilées. |
| `HAS_THREE` | boolean | Three.js est chargé ; sinon les ressources partagées valent `null` et `init()` affiche un message. |
| `GOLD` | matériau | Matériau doré partagé (pastilles, bornes, axes), jamais libéré. |
| `PAD_GEO` | géométrie | Pastille partagée par tous les pôles et extrémités libres, jamais libérée. |

## Variables internes

| Nom | Contenu |
|---|---|
| `renderer`, `scene`, `camera`, `controls`, `raycaster` | Objets Three.js. |
| `root` | Groupe contenant toute la scène générée (reconstruit à chaque `build`). |
| `wrap` | Conteneur DOM `#view3dWrap`. |
| `dyn` | Objets animés : `leds`, `levers`, `caps`, `knobs`, `rotors`, `texts`, `traces`, `cables`, `hits`. |
| `dirty` | Scène à reconstruire. |
| `visible` | Onglet affiché (la boucle ne dessine rien sinon). |
| `needsFrame` | Une nouvelle image est à dessiner (rendu à la demande). |
| `pressed` | Bouton 3D actuellement maintenu. |

## Fonctions publiques

### `V3.init() → boolean`
Crée le renderer, la caméra, OrbitControls (avec amortissement), les lumières (ambiante + directionnelle), un brouillard et une grille au sol. Branche le redimensionnement, les clics et le menu de disposition. Si `THREE` n'est pas chargé (pas de réseau), affiche un message et retourne `false`.

### `V3.resize()`
Adapte le renderer et le ratio de la caméra à la taille du conteneur.

### `V3.build(refit)`
(Re)construit toute la scène depuis `App.project`. Libère d'abord les géométries, matériaux et textures de l'ancienne scène.

1. **Disposition** (`#layout3d`) :
   - `stack` : plaques empilées, la i-ème à `y = i × STACK_GAP`, avec quatre entretoises métalliques vers la suivante ;
   - `row` : plaques alignées sur l'axe X, 2 unités d'écart.
2. **Plaque** : boîte verte de la taille de `App.boardBounds` + 1,5 unité de marge. Le dessus porte une texture « sérigraphie » (quadrillage, cadre, nom de la plaque), avec un contour vert lumineux.
3. **Pistes** : un segment plat par portion du tracé de chaque fil (`App.wirePath`, donc avec ses points de passage), dans un matériau propre au fil, de couleur `wire.color` (vert par défaut), pour pouvoir l'éclairer selon la tension. Chaque extrémité libre reçoit une pastille de la même couleur.
4. **Composants** : `buildShape`, positionnés au centre du composant, rotation `−rot`. Une pastille dorée par pôle et une étiquette (sprite) au-dessus. Une étiquette jaune pour les valeurs (`display` `value` / `motor`).
5. **Câbles inter-plaques** : pour chaque canal, un connecteur représentant par plaque, chaînés dans l'ordre des plaques. Tube coloré (une teinte par canal) le long d'une courbe Catmull-Rom :
   - empilées : sortie par le bord latéral des plaques, pour rester visible ;
   - côte à côte : arche au-dessus des plaques.
6. Si `refit` : centre OrbitControls sur la scène, place la caméra en vue plongeante et adapte le **brouillard** (de 1,2 à 3 fois la distance de la caméra) et la profondeur de vue à la taille de la scène, pour que les grands projets ne disparaissent pas dans le brouillard.

Les étiquettes fixes de même texte et même couleur partagent une seule texture (`cachedLabel`) : un projet de 1 000 composants se construit en moins d'une demi-seconde.

### `V3.updateDynamic()`
Reporte l'état de la simulation sur la scène :

| Objet | Source | Effet |
|---|---|---|
| LED / voyants | `state.light` | intensité émissive ×1,6 et lumière ponctuelle ×1,5 |
| levier d'interrupteur | `ui.on` | inclinaison ±0,5 rad |
| capuchon de bouton | `ui.pressed` | enfoncé de 0,07 |
| bouton de potentiomètre | `ui.value` | rotation sur ±135° |
| afficheurs | `state.text` | texte du sprite (redessiné seulement s'il change) |
| pistes | tension du fil (`Sim.wireValue`) | lueur proportionnelle à la tension (au moins 15 % dès que le nœud est piloté, même à 0 V ; éteinte s'il est flottant), seulement pendant la simulation |
| câbles | tension du canal | lueur de 0,15 à 0,95 |

### `V3.show()`
À l'ouverture de l'onglet : `init` au premier appel, redimensionnement, reconstruction si `dirty` (recadrée la première fois), démarrage de la boucle.

### `V3.hide()`
Suspend le rendu (la boucle tourne mais ne dessine rien).

## Fonctions privées

### `canvasTexture(w, h, draw) → CanvasTexture`
Crée un canvas `w × h`, appelle `draw(ctx, w, h)` et en fait une texture (anisotropie 4).

### `makeLabel(text, color, height) → Sprite`
Sprite d'étiquette (canvas 256×64, fond semi-transparent, police monospace). Le sprite expose `sprite.setText(t)`, qui ne redessine que si le texte change.

### `cachedLabel(cache, text, color, height) → Sprite`
Étiquette fixe : réutilise le matériau (donc la texture) déjà créé pour le même texte et la même couleur pendant ce `build`. Les étiquettes de valeurs, qui changent, utilisent `makeLabel`.

### `mat(color, extra) → MeshStandardMaterial`
Matériau standard (rugosité 0,6, métal 0,1) avec options supplémentaires.

### `buildShape(def, g, props) → { grp, parts }`
Construit le modèle 3D d'une définition selon `def.shape3d` (liste dans [Programmer un composant](Programmer-un-composant#formes-3d-shape3d)), dimensionné d'après la géométrie `g`. `parts` contient les sous-objets animables : `led { mat, glow? }`, `lever`, `cap`, `knob`, `rotor`.

### `loop()`
Boucle `requestAnimationFrame` permanente. Si la vue est visible : met à jour OrbitControls ; pendant la simulation, fait tourner les rotors (`speed × 0,25` rad par image) et force une image. Ne dessine (`updateDynamic` + `render`) que si `needsFrame`.

### `pick(e) → { board, comp, def } | null`
Lance un rayon depuis le pointeur sur les composants interactifs (`dyn.hits`) et remonte jusqu'au groupe qui porte `userData.comp`.

### `onDown(e)` / `onUp()`
Clic gauche sur un composant interactif : désactive OrbitControls (pour ne pas tourner la vue), puis `switch` → bascule, `slider` → +25 %, `button` → appuyé. Au relâchement (n'importe où) : relâche le bouton et réactive OrbitControls.

## Abonnements

| Événement | Réaction |
|---|---|
| `change` | `dirty = true` ; reconstruction immédiate (sans recadrage) si l'onglet est visible. |
| `project` | `dirty = true` ; reconstruction recadrée si l'onglet est visible. |
| `sim`, `simstate` | `needsFrame = true`. |
