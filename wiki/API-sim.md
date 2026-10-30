# API — `js/sim.js`

Simulateur. Objet public : **`App.Sim`**. Le fonctionnement général est décrit dans
[Simulateur](Simulateur).

## Propriétés

| Propriété | Type | Description |
|---|---|---|
| `running` | boolean | Boucle de simulation active. |
| `t` | number | Temps simulé (s). |
| `ui` | `{ [compKey]: { on, pressed, value } }` | État des contrôles interactifs. |
| `states` | `{ [compKey]: object }` | `state` mémorisé de chaque instance. |
| `pinNet` | `{ [pinKey]: netId }` | Nœud de chaque pôle. |
| `wireNet` | `{ ["plaque/fil"]: netId }` | Nœud de chaque fil (y compris les fils sans pôle). |
| `netVal` | `{ [netId]: number }` | Tension des nœuds pilotés (un nœud absent est flottant). |
| `conflicts` | `{ [netId]: true }` | Nœuds pilotés par des tensions différentes. |
| `errors` | `{ [compKey]: string }` | Dernière erreur d'exécution par instance. |
| `items` | array | Instances simulées : `{ key, board, comp, def, props, fn, nets }` ; `nets[i]` = nœud du i-ème pôle. |
| `dirty` | boolean | Nœuds à reconstruire avant le prochain calcul. |
| `lastOutputs` | object \| null | Sorties du dernier état stable : point de départ du pas suivant (démarrage à chaud). Remis à `null` par `rebuild` et `reset`. |
| `changed` | boolean | Le dernier `evaluate` ou `interact` a modifié une sortie, un `state` ou un contrôle : la vue doit être redessinée. |

**Clés** : `compKey = "<boardId>/<compId>"`, `pinKey = "<boardId>/<compId>/<pôle>"`,
extrémité libre : `"pt:<boardId>:<x>,<y>"` (privée, utilisée seulement pour l'union-find).

## Constantes et caches privés

| Nom | Description |
|---|---|
| `MAX_ITER = 200` | Nombre maximal d'itérations pour stabiliser un pas (≈ nombre de portes en série). |
| `compiled` | Cache `defId → { code, fn }` des programmes compilés. |

---

## Fonctions publiques

### `Sim.compKey(boardId, compId) → string`
Construit la clé d'une instance.

### `Sim.compile(def) → function`
Compile `def.logic` avec `new Function('inp', 'props', 'state', 'ui', 't', code)`. Le résultat est mis en cache tant que le code ne change pas. En cas d'erreur de syntaxe, retourne une fonction qui lève `erreur de syntaxe : …` à chaque appel : l'erreur apparaît alors dans le panneau du simulateur.

### `Sim.uiFor(key) → { on, pressed, value }`
État du contrôle de l'instance `key`, créé à `{ on: false, pressed: false, value: 0.5 }` au premier accès.

### `Sim.rebuild()`
Reconstruit `items` (avec `nets` précalculés), `pinNet` et `wireNet` pour tout le projet, oublie `lastOutputs` (union-find sur les extrémités des fils, les jonctions d'extrémités libres et les canaux des connecteurs), puis remet `dirty` à `false`. Détails : [Simulateur §1](Simulateur#1-construction-des-nœuds--simrebuild).

### `Sim.evaluate()`
Calcule un état stable au temps `t` : reconstruit si `dirty`, part de `lastOutputs`, itère jusqu'à stabilité (200 itérations au plus) puis met à jour `lastOutputs`, `netVal`, `conflicts`, `states`, `errors` et `changed`. N'émet pas d'événement. Détails : [Simulateur §2](Simulateur#2-un-pas-de-simulation--simevaluate).

### `Sim.valueAt(boardId, compId, pin) → number | null`
Tension du nœud relié à ce pôle, `null` s'il est flottant.

### `Sim.netOf(boardId, compId, pin) → netId`
Identifiant du nœud du pôle (utile pour comparer deux pôles ou lire `conflicts`).

### `Sim.wireValue(boardId, wireId) → number | null`
Tension du nœud d'un fil (`null` = flottant). Sert à colorer les fils en 2D et en 3D.

### `Sim.canalNet(canal) → netId | null`
Nœud d'un canal de connecteur (celui de son premier connecteur ; tous sont dans le même nœud). Sert à repérer les fils et composants reliés au canal isolé.

### `Sim.wireConflict(boardId, wireId) → boolean`
Vrai si le nœud du fil est en conflit.

### `Sim.stateOf(boardId, compId) → object`
`state` mémorisé de l'instance (`{}` par défaut).

### `Sim.start()`
Démarre la boucle (`requestAnimationFrame`), force une reconstruction et émet `simstate`. Sans effet si elle tourne déjà.

### `Sim.stop()`
Arrête la boucle et émet `simstate`.

### `Sim.toggle()`
`stop()` si la boucle tourne, `start()` sinon.

### `Sim.reset()`
Remet `t` à 0 et vide `states`, `ui`, `netVal` et `errors`. Si la boucle est arrêtée, refait un `evaluate()`. Émet `sim`.

### `Sim.interact(boardId, compId, action, value)`
Applique une action utilisateur selon `def.interactive` :

| `interactive` | `action` | Effet |
|---|---|---|
| `switch` | `'click'` | bascule `ui.on` |
| `button` | `'down'` / tout autre | `ui.pressed = (action === 'down')` |
| `slider` | `'set'` | `ui.value = value` borné à [0, 1] |
| `slider` | `'click'` | `ui.value` avance de 0,25 et revient à 0 après 1 |

Si la boucle est arrêtée, refait un `evaluate()`. Met `changed` à `true`, émet `sim`.

### `Sim.testLogic(def, inp, props, ui, t, state) → { out, state }`
Exécute **une fois** le programme d'une définition, hors circuit (zone « tester » de l'éditeur). Vide le cache de compilation de `def`, fusionne `def.props` et `props`, complète `ui` avec les valeurs par défaut et travaille sur une copie de `state`. Les exceptions **ne sont pas** interceptées : l'appelant les affiche.

---

## Fonctions privées

### `endKey(boardId, end) → string`
Clé union-find d'une extrémité de fil : `pinKey` pour un pôle, `pt:<plaque>:<x>,<y>` pour un point libre.

### `normalizeOut(v, props) → number | null`
Convertit une valeur retournée par un programme : `true` → `props.V` (ou 5), `false` → 0, `null` / `undefined` / `''` → `null`, nombre (ou chaîne numérique) → nombre, autre → `null`.

### `netsFromOutputs(outputs) → { vals, conflicts }`
Rassemble, pour chaque nœud, les valeurs non nulles des pôles `out` / `io`, retient la plus grande et marque un conflit si elles diffèrent de plus de 1e-6.

### `loop(now)`
Corps de la boucle : `t += min(0,1, Δt)`, `evaluate()`, `emit('sim')`, image suivante.

---

## Abonnements

| Événement | Réaction |
|---|---|
| `change` | `dirty = true` ; si la simulation est arrêtée, `evaluate()` immédiat (la vue d'édition et la 3D restent à jour). |
