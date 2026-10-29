# Exemple : calculateur binaire

Fichier : [`examples/calculateur-binaire.json`](https://github.com/Turos14/beta/blob/main/examples/calculateur-binaire.json)
([téléchargement direct](https://raw.githubusercontent.com/Turos14/beta/main/examples/calculateur-binaire.json)).
L'ouvrir avec le bouton **importer**.

Calcule **A + B, A − B, A × B et A ÷ B** sur deux nombres de 4 bits (0 à 15), avec le
résultat sur 8 LED (0 à 255), en décimal, et des voyants « négatif » et « erreur ».

## Les trois plaques

| Plaque | Contenu |
|---|---|
| **Entrées** | Un rail +5 V (fil rouge) alimente 10 interrupteurs : `A0`–`A3` (fils bleus), `B0`–`B3` (fils jaunes), `OP0`–`OP1` (fils violets). L'**indicateur d'opération** affiche l'opération choisie. |
| **Calcul** | L'**UAL 4 bits** (unité arithmétique) reçoit les 10 entrées et produit `R0`–`R7`, `NEG`, `ERR`. Son afficheur montre le calcul complet, par ex. `13 × 11 = 143`. |
| **Affichage** | 8 LED vertes pour `R0`–`R7` (poids 1 à 128), une LED orange `NÉGATIF`, une rouge `ERREUR`, et l'**afficheur décimal** : `143 (10001111)`. |

Les plaques sont reliées par des **connecteurs** : un canal par signal (`A0`…`OP1`,
`R0`…`ERR`). En 3D, on voit un câble par canal entre les plaques empilées.

## Utilisation

1. Onglet **Simulateur**, `▶ simuler`.
2. Composer **A** avec les interrupteurs `A0` (1), `A1` (2), `A2` (4), `A3` (8) : par ex. 13 = 8 + 4 + 1 → `A3`, `A2`, `A0` sur ON.
3. Composer **B** de la même façon avec `B0`–`B3`.
4. Choisir l'opération :

| OP1 | OP0 | Opération | Résultat |
|---|---|---|---|
| OFF | OFF | addition | 0 à 30 |
| OFF | ON | soustraction | −15 à 15 : valeur absolue sur les LED, LED `NÉGATIF` allumée si A < B |
| ON | OFF | multiplication | 0 à 225 |
| ON | ON | division entière | quotient sur les LED, reste affiché par l'UAL (`13 ÷ 4 = 3 r1`) ; `B = 0` → LED `ERREUR` |

Les interrupteurs se commandent aussi depuis le panneau de droite, ou en cliquant dessus
en 3D.

## Les composants créés pour l'exemple

Catégorie **Calculateur** de la bibliothèque (onglet Composants : on peut lire et modifier
leur programme).

### UAL 4 bits — `alu4`

```js
// Un bit vaut 1 si sa tension dépasse le seuil (un fil flottant vaut 0)
const bit = v => (v || 0) >= props.seuil ? 1 : 0;
const A = bit(inp.A0) + 2 * bit(inp.A1) + 4 * bit(inp.A2) + 8 * bit(inp.A3);
const B = bit(inp.B0) + 2 * bit(inp.B1) + 4 * bit(inp.B2) + 8 * bit(inp.B3);
const op = bit(inp.OP0) + 2 * bit(inp.OP1);   // 0 : +   1 : −   2 : ×   3 : ÷

let r = 0, neg = false, err = false;
if (op === 0) r = A + B;
else if (op === 1) { r = A - B; if (r < 0) { neg = true; r = -r; } }
else if (op === 2) r = A * B;
else if (B === 0) err = true;
else r = Math.floor(A / B);

const sym = ['+', '−', '×', '÷'][op];
state.text = A + ' ' + sym + ' ' + B + ' = ' + (err ? 'ERR' : (neg ? '-' : '') + r + (op === 3 ? ' r' + (A % B) : ''));

// Résultat en binaire sur 8 bits (valeur absolue)
const out = { NEG: neg ? props.V : 0, ERR: err ? props.V : 0 };
for (let i = 0; i < 8; i++) out['R' + i] = (r >> i) & 1 ? props.V : 0;
return out;
```

1. Chaque groupe de 4 entrées est converti en nombre (poids 1, 2, 4, 8).
2. `OP0` / `OP1` donnent le numéro de l'opération.
3. Le résultat est décomposé bit par bit : `(r >> i) & 1` vaut 1 si le bit `i` est à 1, et la sortie `Ri` reçoit alors 5 V.

### Afficheur décimal — `dec8`

Recompose le nombre à partir de `D0`–`D7` (`n += bit << i`) et affiche `-` si `NEG`,
`ERREUR` si `ERR`, sinon `n (binaire sur 8 chiffres)`.

### Indicateur d'opération — `opview`

Affiche `+ addition`, `− soustraction`, `× multiplication` ou `÷ division` selon `OP0` / `OP1`.

## Idées d'extension

- Passer en 8 bits : ajouter `A4`–`A7` / `B4`–`B7` à l'UAL et 8 sorties de plus.
- Sortir le reste de la division sur 4 LED supplémentaires.
- Remplacer l'UAL par un vrai additionneur fait de portes ET / OU-X (demi-additionneurs en cascade).

Vérification : les 1024 combinaisons (A, B de 0 à 15, 4 opérations) ont été testées dans
l'application ; LED et afficheur donnent toutes le bon résultat.
