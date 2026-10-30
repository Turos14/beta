# API — `js/model.js`

Projet, événements, géométrie des composants, modifications et sauvegarde.
Toutes les fonctions sont attachées à `App`.

## Constantes et état

| Nom | Valeur / type | Description |
|---|---|---|
| `App.GRID` | `10` | Pas de la grille d'aimantation (px). |
| `PIN_STEP` *(privé)* | `20` | Espacement entre deux pôles d'un même côté (px). |
| `STORAGE_KEY` *(privé)* | `'circuit3d.project'` | Clé `localStorage`. |
| `App.state` | `{ boardId, selection, wireColor }` | Plaque affichée, sélection dans l'éditeur, couleur des nouveaux fils. |
| `App.WIRE_COLORS` | `[[couleur, libellé], …]` | Couleurs proposées pour les fils ; la première (`''`, « défaut ») = couleur du thème. |
| `App.project` | objet | Projet courant, défini par `App.setProject`. |

---

## Préférences d'affichage

### `App.prefs`
Options propres au navigateur (pas au projet), relues au chargement depuis `localStorage` (clé `circuit3d.prefs`) :

| Clé | Défaut | Effet |
|---|---|---|
| `showLinks` | `false` | Liaisons entre connecteurs dans le schéma et le simulateur. |
| `cables3d` | `true` | Câbles entre plaques dans la vue 3D. |
| `fog3d` | `true` | Brouillard (assombrissement des objets éloignés) en 3D. |

### `App.setPref(key, value)`
Change une option, l'enregistre (erreurs de stockage ignorées) et émet `prefs` avec le nom de l'option.

### `App.setFocusCanal(canal)`
Isole un canal de connecteur (`null` pour tout réafficher). Sans effet si c'est déjà le canal isolé ; sinon met à jour `App.state.focusCanal` et émet `focus`. `App.setProject` remet le canal isolé à `null`.

### `App.connCanal(comp) → string`
Canal d'une instance de connecteur (`props.canal` effectif, en texte).

### `App.channelColor(canal) → string`
Couleur `hsl(…)` stable d'un canal de connecteur, dérivée d'un hachage de son nom : la même en 2D (liaisons) et en 3D (câbles), et la même d'une session à l'autre.

---

## Événements

### `App.on(evt, fn)`
Abonne `fn` à l'événement `evt`. Liste des événements : [Architecture](Architecture#bus-dévénements).

### `App.emit(evt, data)`
Appelle de façon synchrone tous les abonnés de `evt` avec `data`.

---

## Utilitaires

### `App.uid(prefix) → string`
Identifiant aléatoire court : `prefix + '_' + 6 caractères base 36` (ex. `c_k3f9za`).

### `App.clone(o) → object`
Copie profonde par `JSON.parse(JSON.stringify(o))`. Les fonctions et `undefined` sont perdus.

### `App.snap(v) → number`
Arrondit `v` au multiple de `App.GRID` le plus proche.

---

## Accès au projet

### `App.getDef(type) → définition | undefined`
Définition de la bibliothèque dont l'`id` vaut `type`.

### `App.board() → plaque`
Plaque courante (`App.state.boardId`), ou la première si l'id est introuvable.

### `App.findComp(board, id) → instance | undefined`
Instance d'id `id` dans `board.components`.

### `App.compProps(comp, def) → object`
Paramètres effectifs : `def.props` surchargés par `comp.props` (nouvel objet).

---

## Géométrie

### `App.defGeom(def) → { w, h, pins[] }`
Taille d'un composant et position de ses pôles, **avant rotation**, dans le repère du composant (origine en haut à gauche).

- `w = def.w` si défini, sinon `max((nb max de pôles en haut/bas + 1) × 20, 80)`.
- `h = def.h` si défini, sinon `max((nb max de pôles à gauche/droite + 1) × 20, 40)`.
- Les pôles d'un même côté sont centrés et espacés de 20 px.
- Chaque entrée de `pins` : `{ name, type, side, x, y, dir }`, où `dir` est le vecteur sortant (`left` → `[-1, 0]`, `right` → `[1, 0]`, `top` → `[0, -1]`, `bottom` → `[0, 1]`).

### `App.rotVec(dx, dy, rot) → [dx', dy']`
Tourne un vecteur de `rot` degrés (0/90/180/270, sens horaire à l'écran). Les angles négatifs sont ramenés dans 0..359.

### `App.pinWorld(comp, pinName) → { x, y, dir } | null`
Position absolue (coordonnées du schéma) d'un pôle d'une instance, en tenant compte de la rotation autour du centre, et sa direction sortante pivotée. `null` si la définition ou le pôle n'existe pas.

---

## Fils

Une extrémité de fil est un **pôle** `{ c, p }` ou un **point libre** `{ x, y }`.

### `App.isPinEnd(end) → boolean`
Vrai si l'extrémité est un pôle (`end.c` est une chaîne).

### `App.sameEnd(u, v) → boolean`
Vrai si deux extrémités désignent le même pôle, ou le même point libre.

### `App.endPos(board, end) → { x, y, dir } | null`
Position d'une extrémité. Pour un pôle : `App.pinWorld`, donc avec sa direction sortante. Pour un point libre : `dir = null`. `null` si le composant ou le pôle n'existe pas.

### `App.wirePath(board, wire) → [[x, y], …] | null`
Points du tracé complet d'un fil : `routePoints(endPos(a), endPos(b), wire.pts)`. `null` si une extrémité est introuvable.

### `App.routePoints(A, B, via) → [[x, y], …]`
Tracé orthogonal entre deux positions `{ x, y, dir }`. `dir` peut être `null` (point libre, pointeur).

1. Départ en `A`, puis un segment de 10 px dans la direction du pôle s'il y en a une.
2. **Sans `via`** (tracé automatique) : si l'écart horizontal domine, horizontal jusqu'à une abscisse médiane (aimantée), vertical, puis horizontal ; sinon l'inverse.
3. **Avec `via`** (points de passage) : on rejoint chaque point, puis l'approche de `B`, par un coude à angle droit. Le premier segment suit l'axe du pôle de départ, les suivants commencent à l'horizontale.
4. Un segment de 10 px vers `B` (si `B` a une direction), puis l'arrivée en `B`.

Les points consécutifs identiques sont supprimés.

### `App.bestViaIndex(board, wire, pt) → number`
Position, dans `wire.pts`, où insérer `pt` pour que le tracé obtenu soit le plus court (distance de Manhattan). Sert à ajouter un point « là où l'on a cliqué » sans casser l'ordre des points existants.

### `App.pinNear(board, pt, radius) → { c, p } | null`
Pôle le plus proche de `pt` dans un rayon de `radius` px. Utilisé pour brancher une extrémité libre lâchée près d'un pôle.

### `App.boardBounds(board) → { x, y, w, h }`
Rectangle englobant de tous les composants d'une plaque (avec une marge qui couvre toutes les rotations). Plaque vide : `{ 0, 0, 400, 300 }`. Utilisée pour recadrer la vue 2D et dimensionner les plaques 3D.

---

## Modifications

### `App.changed(reason)`
À appeler après **toute** modification de `App.project`. Émet `change` avec `reason`, puis programme `saveLocal` 300 ms plus tard (les appels rapprochés sont regroupés).

### `App.saveLocal()`
Écrit le projet dans `localStorage`. Les erreurs (navigation privée, quota) sont ignorées.

### `App.loadLocal() → object | null`
Relit et parse le projet sauvegardé, `null` s'il est absent ou illisible.

### `App.normalizeProject(p) → projet`
Valide et complète un projet brut (import, JSON édité, sauvegarde). Règles détaillées : [Format du projet JSON](Format-du-projet-JSON#validation-au-chargement). **Modifie l'objet reçu** : passer une copie (`App.clone`) si on veut juste valider. Lève une `Error` au message lisible si le projet est invalide.

### `App.setProject(p, keepBoard)`
Remplace le projet courant par `normalizeProject(p)`. Si `keepBoard` est vrai et que la plaque courante existe encore, elle reste sélectionnée, sinon on passe à la première. Vide la sélection, émet `project` puis `change('project')`.

### `App.addBoard(name) → plaque`
Ajoute une plaque vide (nom par défaut « Plaque N »), la rend courante, émet `change('board')`.

### `App.addComponent(board, type, x, y) → instance | null`
Crée une instance de `type` aimantée sur la grille. Un connecteur reçoit `props.canal = 'A'`. Émet `change('comp')`. `null` si le type est inconnu.

### `App.removeComponent(board, id)`
Supprime l'instance et tous les fils dont une extrémité est un de ses pôles. Émet `change('comp')`.

### `App.addWire(board, a, b, extra) → fil | null`
Ajoute un fil entre deux extrémités (pôle ou point libre). `extra` facultatif : `{ pts, color }` (une couleur vide est ignorée, les points sont copiés). Retourne `null` (sans rien ajouter) pour :
- un fil d'une extrémité vers elle-même sans point de passage ;
- un doublon pôle–pôle, dans un sens comme dans l'autre.

Émet `change('wire')`.

### `App.addViaPoint(board, wire, p)` *(défini dans schematic.js)*
Insère le point `p = [x, y]` dans `wire.pts` à l'index donné par `bestViaIndex` (crée `pts` au besoin), puis émet `change('wire')`.

### `App.renamePin(type, oldName, newName)`
Met à jour, dans toutes les plaques, les extrémités de fils qui pointaient vers `oldName` sur une instance de `type`. N'émet rien : l'appelant appelle `App.changed`.

### `App.pruneWires()`
Supprime partout les fils dont une extrémité **pôle** pointe vers un composant, une définition ou un pôle qui n'existe plus. Les extrémités libres sont toujours valides. N'émet rien.

### `App.channels() → { [canal]: [{ board, comp }] }`
Recense les connecteurs du projet, regroupés par valeur de `canal`. Sert à l'inspecteur (liste des liaisons) et à la vue 3D (câbles).

---

## Projets prêts à l'emploi

### `App.demoProject() → projet`
Projet « Démo » à trois plaques :
- **Alimentation** : pile, interrupteur « Marche », voltmètre, connecteurs `PWR` et `GND`.
- **Affichage** : résistance + LED rouge, potentiomètre + moteur, alimentés par `PWR` / `GND`.
- **Logique** : horloge 1 Hz ET bouton → LED verte.

### `App.emptyProject() → projet`
Projet vide avec la bibliothèque par défaut (`normalizeProject` y ajoutera une plaque).
