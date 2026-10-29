# Composants de base

Bibliothèque fournie par défaut (`js/library.js`, constante `App.DEFAULT_LIBRARY`).
Elle est **copiée dans chaque projet** (`project.library`) : tous ces composants peuvent
être modifiés, dupliqués ou supprimés depuis l'onglet Composants, sauf le Connecteur
(`builtin: true`). Pour l'API du programme, voir [Programmer un composant](Programmer-un-composant).

> La simulation est **logique** : elle propage des tensions mais ne calcule ni courants
> ni chutes de tension. Une résistance transmet donc la tension de A vers B.

## Récapitulatif

| Composant | id | Catégorie | Pôles | Interaction | Affichage | Forme 3D |
|---|---|---|---|---|---|---|
| [Pile](#battery) | `battery` | Alimentation | +, - | none | none | cylinder |
| [Masse](#gnd) | `gnd` | Alimentation | GND | none | none | box |
| [VCC](#vcc) | `vcc` | Alimentation | VCC | none | none | box |
| [Interrupteur](#switch) | `switch` | Commandes | A, B | switch | none | switch |
| [Bouton poussoir](#button) | `button` | Commandes | A, B | button | none | button |
| [Potentiomètre](#pot) | `pot` | Commandes | VCC, GND, OUT | slider | none | pot |
| [Horloge](#clock) | `clock` | Commandes | OUT | none | led | chip |
| [Résistance](#resistor) | `resistor` | Passifs | A, B | none | none | resistor |
| [LED](#led) | `led` | Sorties | A, K | none | led | led |
| [Moteur](#motor) | `motor` | Sorties | A, B | none | motor | motor |
| [Voltmètre](#probe) | `probe` | Mesure | IN | none | value | probe |
| [Porte ET](#and) | `and` | Logique | A, B, Y | none | none | chip |
| [Porte OU](#or) | `or` | Logique | A, B, Y | none | none | chip |
| [Porte OU-X](#xor) | `xor` | Logique | A, B, Y | none | none | chip |
| [Inverseur](#not) | `not` | Logique | A, Y | none | none | chip |
| [Bascule D](#dff) | `dff` | Logique | D, CLK, Q, nQ | none | none | chip |
| [Connecteur](#connector) | `connector` | Liaison | P | none | none | connector |

---

## Alimentation

<a id="battery"></a>
### Pile — `battery`

Source de tension continue. Le pôle + impose V volts, le pôle − impose 0 V.

| Pôle | Côté | Type |
|---|---|---|
| `+` | droite | out |
| `-` | droite | out |

- **Paramètres (props)** : `{"V":5}`
- **Interaction** : `none` · **Affichage** : `none` · **Forme 3D** : `cylinder` · **Couleur** : `#d64545`

```js
return { '+': props.V, '-': 0 };
```

**Fonctionnement** : impose en permanence `props.V` sur `+` et 0 V sur `-`. Les deux pôles sont des sorties : relier `-` à la masse ou à un connecteur `GND`.

<a id="gnd"></a>
### Masse — `gnd`

Référence 0 V commune du circuit.

| Pôle | Côté | Type |
|---|---|---|
| `GND` | haut | out |

- **Paramètres (props)** : aucun
- **Interaction** : `none` · **Affichage** : `none` · **Forme 3D** : `box` · **Couleur** : `#888888` · **Taille imposée** : 60×auto

```js
return { GND: 0 };
```

**Fonctionnement** : impose 0 V sur `GND`. Plusieurs masses sur une même plaque ne sont **pas** reliées entre elles automatiquement : il faut les câbler, ou utiliser des connecteurs de même canal.

<a id="vcc"></a>
### VCC — `vcc`

Rail d'alimentation à tension fixe.

| Pôle | Côté | Type |
|---|---|---|
| `VCC` | bas | out |

- **Paramètres (props)** : `{"V":5}`
- **Interaction** : `none` · **Affichage** : `none` · **Forme 3D** : `box` · **Couleur** : `#e67e22` · **Taille imposée** : 60×auto

```js
return { VCC: props.V };
```

**Fonctionnement** : impose `props.V` sur `VCC`. Pratique pour alimenter des portes logiques sans tirer de fil depuis la pile.

---

## Commandes

<a id="switch"></a>
### Interrupteur — `switch`

Laisse passer la tension de A vers B lorsqu'il est fermé. Cliquer pour basculer.

| Pôle | Côté | Type |
|---|---|---|
| `A` | gauche | in |
| `B` | droite | out |

- **Paramètres (props)** : aucun
- **Interaction** : `switch` · **Affichage** : `none` · **Forme 3D** : `switch` · **Couleur** : `#3fa7d6`

```js
return { B: ui.on ? inp.A : null };
```

**Fonctionnement** : si `ui.on` est vrai (interrupteur fermé), `B` recopie la tension lue sur `A`. Sinon `B` vaut `null` : le composant n'impose rien et le nœud de `B` devient flottant s'il n'a pas d'autre source.

**Interaction** : clic sur le composant (2D ou 3D) ou bouton ON/OFF du panneau.

> Le contact est orienté : la source doit être reliée à `A`.

<a id="button"></a>
### Bouton poussoir — `button`

Contact momentané : A est relié à B tant que le bouton est maintenu.

| Pôle | Côté | Type |
|---|---|---|
| `A` | gauche | in |
| `B` | droite | out |

- **Paramètres (props)** : aucun
- **Interaction** : `button` · **Affichage** : `none` · **Forme 3D** : `button` · **Couleur** : `#2e86c1`

```js
return { B: ui.pressed ? inp.A : null };
```

**Fonctionnement** : comme l'interrupteur, mais piloté par `ui.pressed`, qui n'est vrai que tant que le pointeur reste appuyé.

<a id="pot"></a>
### Potentiomètre — `pot`

Diviseur de tension réglable : OUT varie entre GND et VCC selon le curseur.

| Pôle | Côté | Type |
|---|---|---|
| `VCC` | gauche | in |
| `GND` | gauche | in |
| `OUT` | droite | out |

- **Paramètres (props)** : aucun
- **Interaction** : `slider` · **Affichage** : `none` · **Forme 3D** : `pot` · **Couleur** : `#8e44ad`

```js
const lo = inp.GND || 0, hi = inp.VCC || 0;
return { OUT: lo + (hi - lo) * ui.value };
```

**Fonctionnement** : `lo` et `hi` sont les tensions lues sur `GND` et `VCC` (0 si flottantes). `OUT` est l'interpolation linéaire entre les deux selon `ui.value` (0 → `GND`, 1 → `VCC`).

**Interaction** : glisser horizontalement sur le composant dans le simulateur ; clic en 3D = +25 % (0 → 0,25 → … → 1 → 0) ; curseur dans le panneau.

<a id="clock"></a>
### Horloge — `clock`

Génère un signal carré de fréquence freq (Hz).

| Pôle | Côté | Type |
|---|---|---|
| `OUT` | droite | out |

- **Paramètres (props)** : `{"freq":1,"V":5}`
- **Interaction** : `none` · **Affichage** : `led` · **Forme 3D** : `chip` · **Couleur** : `#16a085`

```js
const high = Math.floor(t * props.freq * 2) % 2 === 1;
state.light = high ? 1 : 0;
return { OUT: high ? props.V : 0 };
```

**Fonctionnement** : `t * freq * 2` compte les demi-périodes ; sa partie entière est paire pendant la moitié basse et impaire pendant la moitié haute. Le voyant intégré (`state.light`) suit la sortie.

Exemple : `freq = 1` donne 0,5 s à 0 V puis 0,5 s à `V`.

---

## Passifs

<a id="resistor"></a>
### Résistance — `resistor`

Limite le courant. En simulation logique, transmet la tension de A vers B.

| Pôle | Côté | Type |
|---|---|---|
| `A` | gauche | in |
| `B` | droite | out |

- **Paramètres (props)** : `{"ohms":220}`
- **Interaction** : `none` · **Affichage** : `none` · **Forme 3D** : `resistor` · **Couleur** : `#c8a165`

```js
return { B: inp.A };
```

**Fonctionnement** : recopie la tension de `A` vers `B`. Le paramètre `ohms` est informatif (il n'est pas utilisé par la simulation logique), mais il apparaît dans l'inspecteur et le JSON.

---

## Sorties

<a id="led"></a>
### LED — `led`

Diode électroluminescente : s'allume quand A − K dépasse le seuil.

| Pôle | Côté | Type |
|---|---|---|
| `A` | gauche | in |
| `K` | droite | in |

- **Paramètres (props)** : `{"seuil":1.8,"couleur":"#ff3b3b"}`
- **Interaction** : `none` · **Affichage** : `led` · **Forme 3D** : `led` · **Couleur** : `#ff3b3b`

```js
const v = (inp.A || 0) - (inp.K || 0);
state.light = v >= props.seuil ? Math.min(1, v / 5 + 0.3) : 0;
return {};
```

**Fonctionnement** : `v` est la tension aux bornes (anode − cathode, les nœuds flottants valent 0). Au-delà de `seuil`, la LED s'allume avec une luminosité de `v / 5 + 0,3` plafonnée à 1, sinon elle reste éteinte. Elle n'impose aucune tension.

`props.couleur` change la couleur en 2D et en 3D (champ couleur dans l'inspecteur).

<a id="motor"></a>
### Moteur — `motor`

Moteur à courant continu : la vitesse dépend de A − B, le signe donne le sens.

| Pôle | Côté | Type |
|---|---|---|
| `A` | gauche | in |
| `B` | droite | in |

- **Paramètres (props)** : `{"Vmax":5}`
- **Interaction** : `none` · **Affichage** : `motor` · **Forme 3D** : `motor` · **Couleur** : `#7f8c8d`

```js
state.speed = ((inp.A || 0) - (inp.B || 0)) / props.Vmax;
state.text = Math.round(state.speed * 100) + ' %';
return {};
```

**Fonctionnement** : `state.speed` est la tension `A − B` rapportée à `Vmax` (1 = pleine vitesse, négatif = sens inverse). `state.text` affiche le pourcentage. En 3D l'hélice tourne de `speed × 0,25` rad par image ; en 2D un trait tourne au centre du composant.

---

## Mesure

<a id="probe"></a>
### Voltmètre — `probe`

Affiche la tension du nœud connecté à IN (Z = flottant).

| Pôle | Côté | Type |
|---|---|---|
| `IN` | gauche | in |

- **Paramètres (props)** : aucun
- **Interaction** : `none` · **Affichage** : `value` · **Forme 3D** : `probe` · **Couleur** : `#f1c40f` · **Taille imposée** : 100×auto

```js
state.text = inp.IN == null ? 'Z' : inp.IN.toFixed(2) + ' V';
return {};
```

**Fonctionnement** : affiche la tension du nœud relié à `IN` avec 2 décimales, ou `Z` si le nœud est flottant. N'impose rien : on peut le brancher n'importe où sans perturber le circuit.

---

## Logique

<a id="and"></a>
### Porte ET — `and`

Y est haut si A et B sont hauts.

| Pôle | Côté | Type |
|---|---|---|
| `A` | gauche | in |
| `B` | gauche | in |
| `Y` | droite | out |

- **Paramètres (props)** : `{"V":5,"seuil":2.5}`
- **Interaction** : `none` · **Affichage** : `none` · **Forme 3D** : `chip` · **Couleur** : `#27ae60`

```js
const h = x => (x || 0) >= props.seuil;
return { Y: h(inp.A) && h(inp.B) ? props.V : 0 };
```

**Fonctionnement** : `h(x)` convertit une tension en niveau logique (haut si ≥ `seuil`, flottant = bas). `Y` vaut `V` si les deux entrées sont hautes, 0 sinon.

<a id="or"></a>
### Porte OU — `or`

Y est haut si A ou B est haut.

| Pôle | Côté | Type |
|---|---|---|
| `A` | gauche | in |
| `B` | gauche | in |
| `Y` | droite | out |

- **Paramètres (props)** : `{"V":5,"seuil":2.5}`
- **Interaction** : `none` · **Affichage** : `none` · **Forme 3D** : `chip` · **Couleur** : `#27ae60`

```js
const h = x => (x || 0) >= props.seuil;
return { Y: h(inp.A) || h(inp.B) ? props.V : 0 };
```

**Fonctionnement** : `Y` vaut `V` si au moins une entrée est haute.

<a id="xor"></a>
### Porte OU-X — `xor`

Y est haut si exactement une entrée est haute.

| Pôle | Côté | Type |
|---|---|---|
| `A` | gauche | in |
| `B` | gauche | in |
| `Y` | droite | out |

- **Paramètres (props)** : `{"V":5,"seuil":2.5}`
- **Interaction** : `none` · **Affichage** : `none` · **Forme 3D** : `chip` · **Couleur** : `#27ae60`

```js
const h = x => (x || 0) >= props.seuil;
return { Y: h(inp.A) !== h(inp.B) ? props.V : 0 };
```

**Fonctionnement** : `Y` vaut `V` si les niveaux de `A` et `B` sont différents.

<a id="not"></a>
### Inverseur — `not`

Y est l'inverse logique de A.

| Pôle | Côté | Type |
|---|---|---|
| `A` | gauche | in |
| `Y` | droite | out |

- **Paramètres (props)** : `{"V":5,"seuil":2.5}`
- **Interaction** : `none` · **Affichage** : `none` · **Forme 3D** : `chip` · **Couleur** : `#27ae60`

```js
return { Y: (inp.A || 0) >= props.seuil ? 0 : props.V };
```

**Fonctionnement** : `Y` vaut 0 si `A` est haut, `V` sinon (une entrée flottante est lue comme basse, donc `Y` est haut).

<a id="dff"></a>
### Bascule D — `dff`

Mémorise D sur front montant de CLK. Exemple de composant avec mémoire (state).

| Pôle | Côté | Type |
|---|---|---|
| `D` | gauche | in |
| `CLK` | gauche | in |
| `Q` | droite | out |
| `nQ` | droite | out |

- **Paramètres (props)** : `{"V":5,"seuil":2.5}`
- **Interaction** : `none` · **Affichage** : `none` · **Forme 3D** : `chip` · **Couleur** : `#1e8449`

```js
const clk = (inp.CLK || 0) >= props.seuil;
if (clk && !state.prev) state.q = (inp.D || 0) >= props.seuil;
state.prev = clk;
return { Q: state.q ? props.V : 0, nQ: state.q ? 0 : props.V };
```

**Fonctionnement** : exemple de composant **à mémoire**.

1. `clk` = niveau logique de `CLK`.
2. Si `clk` est haut et `state.prev` (niveau au pas précédent) était bas, c'est un **front montant** : on mémorise le niveau de `D` dans `state.q`.
3. On mémorise `clk` dans `state.prev` pour le pas suivant.
4. `Q` = `state.q`, `nQ` = son inverse.

Au démarrage `state.q` est indéfini, donc `Q = 0` et `nQ = V`.

---

## Liaison

<a id="connector"></a>
### Connecteur — `connector`

Relie ce point à tous les connecteurs du même canal, sur n'importe quelle plaque du projet.

| Pôle | Côté | Type |
|---|---|---|
| `P` | gauche | link |

- **Paramètres (props)** : `{"canal":"A"}`
- **Interaction** : `none` · **Affichage** : `none` · **Forme 3D** : `connector` · **Couleur** : `#00e5ff` · **Taille imposée** : 40×40

```js
return {};
```

**Fonctionnement** : n'a pas de programme utile. Son pôle `P` est de type `link` : lors de la construction des nœuds, le simulateur fusionne tous les pôles `link` dont la propriété `canal` est identique, **sur toutes les plaques** (voir [Simulateur](Simulateur)). Le schéma affiche le nom du canal dans le composant, la vue 3D trace un câble entre les plaques.

Composant système (`builtin: true`) : pôles et programme verrouillés dans l'éditeur, mais on peut le dupliquer.
