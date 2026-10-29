# API — `js/model.js`

Projet, événements, géométrie des composants, modifications et sauvegarde.
Toutes les fonctions sont attachées à `App`.

## Constantes et état

| Nom | Valeur / type | Description |
|---|---|---|
| `App.GRID` | `10` | Pas de la grille d'aimantation (px). |
| `PIN_STEP` *(privé)* | `20` | Espacement entre deux pôles d'un même côté (px). |
| `STORAGE_KEY` *(privé)* | `'circuit3d.project'` | Clé `localStorage`. |
| `App.state` | `{ boardId, selection }` | Plaque affichée et sélection dans l'éditeur. |
| `App.project` | objet | Projet courant, défini par `App.setProject`. |

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

### `App.wirePath(board, wire) → [[x, y], …] | null`
Points du tracé d'un fil (via `routePoints`). `null` si un composant ou un pôle est introuvable.

### `App.routePoints(A, B) → [[x, y], …]`
Tracé orthogonal entre deux points `{ x, y, dir }`. `B.dir` est facultatif (fil « fantôme » vers le pointeur).

1. Départ en `A`, petit segment de 10 px dans la direction du pôle.
2. Si l'écart horizontal domine : horizontal jusqu'à une abscisse médiane (aimantée), vertical, puis horizontal. Sinon, l'inverse.
3. Segment de 10 px vers `B`, puis arrivée en `B`.

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
Supprime l'instance et tous les fils qui y sont reliés. Émet `change('comp')`.

### `App.addWire(board, a, b) → fil | null`
Ajoute un fil entre `a = { c, p }` et `b = { c, p }`. Refuse (retourne `null`) un fil d'un pôle vers lui-même ou un doublon, dans un sens comme dans l'autre. Émet `change('wire')`.

### `App.renamePin(type, oldName, newName)`
Met à jour, dans toutes les plaques, les extrémités de fils qui pointaient vers `oldName` sur une instance de `type`. N'émet rien : l'appelant appelle `App.changed`.

### `App.pruneWires()`
Supprime partout les fils dont un composant, une définition ou un pôle n'existe plus. N'émet rien.

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
