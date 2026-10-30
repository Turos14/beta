# Exemple : calculateur en portes logiques

Fichier : [`examples/calculateur-binaire-portes.json`](https://github.com/Turos14/beta/blob/main/examples/calculateur-binaire-portes.json)
([téléchargement direct](https://raw.githubusercontent.com/Turos14/beta/main/examples/calculateur-binaire-portes.json)).
L'ouvrir avec le bouton **importer**.

Même calculateur que l'[exemple programmé](Exemple-calculateur-binaire) (A + B, A − B,
A × B, A ÷ B sur 4 bits), mais construit **uniquement avec les composants de base** :
interrupteurs, VCC, masse, **Porte ET**, **Porte OU**, **Porte OU-X**, **Inverseur**, LED et
connecteurs. Aucun programme sur mesure : tout le calcul est fait par **261 portes**
(127 ET, 65 OU-X, 53 OU, 16 inverseurs).

## Lire les schémas

Chaque porte est entourée de **connecteurs-étiquettes** portant le nom de son signal
d'entrée ou de sortie, comme les étiquettes de signaux d'un vrai schéma électronique : deux
connecteurs de même nom sont reliés, sur la même plaque ou d'une plaque à l'autre. On suit
donc un signal en cherchant son nom.

| Préfixe | Bloc | Exemples |
|---|---|---|
| `A0`–`A3`, `B0`–`B3`, `OP0`, `OP1` | entrées | |
| `s…` | addition / soustraction | `sbx2` = B2 inversé si soustraction, `sr1` = somme, `sc3` = retenue, `sneg` = résultat négatif, `sm0`–`sm4` = résultat |
| `pp…`, `p…` | multiplication | `pp21` = A1 ET B2 (produit partiel), `ps…` = sommes, `pc…` = retenues |
| `nb…`, `d1…`–`d4…`, `Q0`–`Q3` | division | `nb2` = NON B2, `d2s1` = soustraction de l'étape 2, `Q3` = bit de quotient, `d4r0` = reste final |
| `o…`, `R0`–`R7`, `NEG`, `ERR`, `RS0`–`RS3` | sélection et sorties | `omul` = multiplication choisie, `R5` = bit 5 du résultat |

## Les plaques

| Plaque | Portes | Rôle |
|---|---|---|
| **Entrées** | — | 10 interrupteurs alimentés par +5 V. |
| **Addition / soustraction** | 39 | Additionneur 4 bits en cascade + correction du signe. |
| **Multiplication** | 64 | Multiplicateur en grille. |
| **Division — étape 1 à 4** | 20, 32, 32, 32 | Division à restauration, un bit de quotient par étape. |
| **Sélection** | 42 | Décodage de l'opération et aiguillage du bon résultat vers les sorties. |
| **Affichage** | — | 18 LED : résultat (R0–R7), négatif, erreur, reste (4 bits) et opération choisie. |

## Comment ça calcule

### Additionneur complet

Brique de base de tous les blocs : il additionne trois bits `a + b + retenue` :

```
x       = a OU-X b
somme   = x OU-X retenue
retenue' = (a ET b) OU (x ET retenue)
```

Quatre additionneurs en cascade (la retenue de l'un entre dans le suivant) font un
additionneur 4 bits. Quand une entrée est constante (0 ou 1), le générateur a supprimé les
portes inutiles : un « demi-additionneur » (OU-X + ET) suffit par exemple si la retenue vaut 0.

### Addition et soustraction (même circuit)

Soustraire B revient à ajouter son **complément à 2** : `A − B = A + (NON B) + 1`.

- `sbx_i = B_i OU-X OP0` : avec `OP0 = 1` (soustraction), chaque bit de B est inversé ;
- la retenue d'entrée vaut `OP0`, ce qui ajoute le `+ 1`.

Si A < B, il n'y a pas de retenue finale : `sneg = OP0 ET NON(retenue)`. Le résultat est
alors en complément à 2 ; pour afficher sa **valeur absolue**, on l'inverse (`st_i = sr_i
OU-X sneg`) puis on ajoute `sneg` avec une chaîne de demi-additionneurs (`sm0`–`sm3`). En
addition, la retenue finale devient le 5ᵉ bit (`sm4`).

### Multiplication

Comme une multiplication posée, en binaire :

1. **16 produits partiels** : `pp_ij = A_j ET B_i` (une ligne par bit de B, décalée d'un rang) ;
2. trois additionneurs 4 bits ajoutent les lignes une à une ;
3. à chaque ligne, le bit de poids faible est définitif (`P1`, `P2`, `P3`), les 4 derniers
   forment `P4`–`P7`. Résultat jusqu'à 15 × 15 = 225 (8 bits).

### Division à restauration

Comme une division posée, un bit de quotient par étape, de A3 vers A0 :

1. on « descend » le bit suivant de A à droite du reste : `X = reste × 2 + A_i` ;
2. on calcule `X − B` avec un soustracteur 5 bits (`X + NON B + 1`) ;
3. la **retenue finale** vaut 1 si `X ≥ B` : c'est le bit de quotient `Q_i` ;
4. un **multiplexeur** garde `X − B` si `Q_i = 1`, sinon restaure `X` :
   `reste_k = (D_k ET Q) OU (X_k ET NON Q)`.

Après 4 étapes : quotient `Q3`–`Q0` et reste final.

### Sélection

- Décodage : `oadd = NON OP1 ET NON OP0`, `osub`, `omul = OP1 ET NON OP0`, `odiv = OP1 ET OP0`
  (allument aussi les voyants d'opération).
- Division par zéro : `bz = B0 OU B1 OU B2 OU B3` ; `ERR = odiv ET NON bz` ;
  `divok = odiv ET bz`.
- Chaque bit de sortie : `R_k = (somme_k ET NON OP1) OU (produit_k ET omul) OU (quotient_k ET divok)`.
- `NEG = sneg ET NON OP1`, reste affiché `RS_k = reste_k ET divok`.

## Utilisation

Comme l'[exemple programmé](Exemple-calculateur-binaire#utilisation) : composer A et B avec
les interrupteurs, choisir l'opération avec `OP1` / `OP0` (00 = +, 01 = −, 10 = ×, 11 = ÷),
lire le résultat en binaire sur les LED (`R0` = 1, `R1` = 2, … `R7` = 128). En division, le
reste s'affiche sur les 4 LED bleues.

Dans le simulateur, survoler un fil donne sa tension ; ouvrir une plaque de calcul permet de
voir les portes s'allumer.

## Vérification et performances

- Les **1024 combinaisons** (A, B de 0 à 15, 4 opérations) ont été testées dans l'application
  en lisant uniquement les LED : toutes justes, reste et voyants compris.
- Le plus long chemin traverse **42 portes** en série (division). Le simulateur a été
  adapté pour ce type de circuit : voir [Simulateur](Simulateur#convergence).

## Régénérer le circuit

Le fichier est produit par un script de génération (netlist → placement en grille, une
case par porte). Pour modifier le calculateur, il est plus simple de partir du JSON et de
l'éditer dans l'application ou dans l'onglet JSON.
