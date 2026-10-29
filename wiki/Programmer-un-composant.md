# Programmer un composant

Un composant est décrit par une **définition** stockée dans `project.library`. Chaque
fois qu'on le place sur un schéma, on crée une **instance** qui référence la définition
par son `id` (champ `type`) et peut surcharger ses paramètres.

## Champs de l'éditeur

| Champ | Clé JSON | Description |
|---|---|---|
| nom | `name` | Nom affiché dans la palette et sur le schéma. |
| catégorie | `category` | Regroupement dans la palette (`Perso` par défaut). |
| couleur | `color` | Couleur du composant en 2D et en 3D. |
| à quoi sert-il ? | `description` | Texte d'aide, affiché en infobulle et dans l'inspecteur. |
| nombre de pôles | `pins.length` | Ajoute (`P1`, `P2`…) ou retire des pôles en fin de liste. |
| table des pôles | `pins[]` | Nom, côté (`left` / `right` / `top` / `bottom`) et type de chaque pôle. |
| interaction | `interactive` | `none`, `switch`, `button` ou `slider` : contrôle dans le simulateur et en 3D. |
| affichage | `display` | `none`, `led`, `value` ou `motor` : retour visuel. |
| forme 3D | `shape3d` | Modèle 3D utilisé (voir plus bas). |
| paramètres | `props` | Objet JSON de valeurs par défaut, modifiables par instance. |
| programme | `logic` | Corps d'une fonction JavaScript (voir plus bas). |
| — | `w`, `h` | Taille imposée en pixels sur le schéma (facultatif, à éditer en JSON). |
| — | `builtin` | `true` = composant système verrouillé (seul le Connecteur l'est). |

Renommer un pôle met à jour les fils existants ; supprimer un pôle supprime les fils qui
y étaient reliés (`App.renamePin`, `App.pruneWires`).

### Types de pôles

| Type | Lit la tension (`inp`) | Impose une tension (valeur retournée) |
|---|---|---|
| `in` | oui | non (ignorée) |
| `out` | oui | oui |
| `io` | oui | oui |
| `link` | — | — : réservé au Connecteur, fusionne les nœuds de même `canal` |

Toutes les tensions de tous les pôles sont disponibles dans `inp`, quel que soit leur type.

## Le programme

Le champ `logic` est le **corps** d'une fonction appelée ainsi :

```js
function (inp, props, state, ui, t) {
  // … votre code …
  return { NomDuPole: valeur, … };
}
```

| Argument | Type | Contenu |
|---|---|---|
| `inp` | `{ [pôle]: number \| null }` | Tension (V) du nœud relié à chaque pôle. `null` = flottant (rien ne l'impose). |
| `props` | `object` | Paramètres : `def.props` fusionnés avec `instance.props`. |
| `state` | `object` | Mémoire persistante d'un pas de simulation à l'autre (voir ci-dessous). |
| `ui` | `{ on, pressed, value }` | État du contrôle interactif : `on` (interrupteur), `pressed` (bouton), `value` 0..1 (curseur, 0,5 au départ). |
| `t` | `number` | Temps de simulation en secondes depuis le démarrage / la réinitialisation. |

### Valeur de retour

Un objet `{ pôle: valeur }`. Seuls les pôles de type `out` ou `io` sont pris en compte.

| Valeur retournée | Interprétation |
|---|---|
| nombre | tension imposée |
| `true` | `props.V` (ou 5 si absent) |
| `false` | 0 V |
| `null`, `undefined`, `''` | rien d'imposé (le pôle n'est pas une source) |
| autre / non numérique | ignoré |

Retourner `{}` (ou rien) si le composant n'impose aucune tension (LED, moteur, voltmètre…).

### `state` : mémoire et affichage

`state` survit entre les pas de simulation et sert aussi à piloter l'affichage :

| Clé | Utilisée par | Effet |
|---|---|---|
| `state.light` | `display: 'led'` | Luminosité 0..1 (2D, 3D, panneau). |
| `state.text` | `display: 'value'` ou `'motor'` | Texte affiché (2D, 3D, panneau). |
| `state.speed` | `display: 'motor'` | Vitesse de rotation (signée) en 3D et en 2D. |
| toute autre clé | votre code | Mémoire libre (ex. `state.prev` pour détecter un front). |

> Pendant un pas, le programme peut être appelé plusieurs fois (recherche d'un état
> stable, voir [Simulateur](Simulateur)). Il reçoit à chaque appel une **copie** de l'état
> du pas précédent ; seul l'état du dernier appel est conservé. On peut donc détecter un
> front montant de façon fiable avec `if (clk && !state.prev) …; state.prev = clk;`.

### Erreurs

Une exception (ou une erreur de syntaxe) est interceptée : le composant n'impose rien pour
ce pas, et le message s'affiche dans le panneau « Erreurs » du simulateur et au-dessus du
composant (`⚠ …`).

## Tester sans simuler

Dans l'éditeur, la zone **tester** propose un champ par pôle d'entrée (vide = `null`), les
contrôles `ui` correspondant à l'interaction, et `t`. `▶ exécuter` appelle le programme
une fois (`App.Sim.testLogic`) et affiche les sorties et le `state`. Le `state` est conservé
entre deux exécutions (pratique pour tester une bascule) ; `vider state` le remet à zéro.

## Formes 3D (`shape3d`)

| Valeur | Rendu |
|---|---|
| `chip` | Boîtier noir avec bande de couleur et point repère ; voyant si `display: 'led'`. |
| `box` | Bloc plein de la couleur du composant. |
| `cylinder` | Cylindre couché avec borne dorée (pile). |
| `resistor` | Corps beige à anneaux de couleur sur fil doré. |
| `led` | Dôme translucide qui s'illumine (+ lumière ponctuelle). |
| `switch` | Socle + levier qui bascule selon `ui.on`. |
| `button` | Socle + capuchon qui s'enfonce selon `ui.pressed`. |
| `pot` | Socle + bouton rotatif orienté selon `ui.value`. |
| `motor` | Carcasse métallique + hélice qui tourne selon `state.speed`. |
| `probe` | Bloc avec afficheur `state.text` au-dessus. |
| `connector` | Bloc sombre lumineux (connecteur inter-plaques). |

## Exemples

### Porte NON-ET (NAND)

Pôles : `A` (in, gauche), `B` (in, gauche), `Y` (out, droite). Props : `{ "V": 5, "seuil": 2.5 }`.

```js
const h = x => (x || 0) >= props.seuil;
return { Y: !(h(inp.A) && h(inp.B)) };   // true → props.V, false → 0
```

### Compteur 2 bits

Pôles : `CLK` (in), `Q0`, `Q1` (out). Props : `{ "V": 5 }`. Affichage : `value`.

```js
const clk = (inp.CLK || 0) > 2.5;
if (clk && !state.prev) state.n = ((state.n || 0) + 1) % 4;
state.prev = clk;
state.text = String(state.n || 0);
return { Q0: (state.n & 1) ? props.V : 0, Q1: (state.n & 2) ? props.V : 0 };
```

### Capteur de lumière réglable

Pôles : `VCC` (in), `OUT` (out). Interaction : `slider`. Affichage : `value`.

```js
const v = (inp.VCC || 0) * ui.value;
state.text = Math.round(ui.value * 100) + ' lux%';
return { OUT: v };
```

### Clignotant à rapport cyclique

Pôles : `OUT` (out). Props : `{ "periode": 2, "ratio": 0.2, "V": 5 }`. Affichage : `led`.

```js
const on = (t % props.periode) < props.periode * props.ratio;
state.light = on ? 1 : 0;
return { OUT: on ? props.V : 0 };
```

### Relais (commande + contact)

Pôles : `C` (in), `COM` (in), `NO` (out). Affichage : `led`.

```js
const actif = (inp.C || 0) > 2.5;
state.light = actif ? 1 : 0;
return { NO: actif ? inp.COM : null };   // null : contact ouvert, NO flottant
```
