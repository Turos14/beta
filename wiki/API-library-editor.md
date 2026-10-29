# API — `js/library-editor.js`

Onglet **Composants** : liste de la bibliothèque, formulaire d'édition, aperçu, test.
Objet public : **`App.LibraryEditor`** (alias interne `Lib`).

## Constantes privées

| Nom | Contenu |
|---|---|
| `SIDES` | `['left', 'right', 'top', 'bottom']` |
| `SIDE_FR` | Libellés français des côtés. |
| `TYPES` | `in` → entrée, `out` → sortie, `io` → entrée/sortie, `link` → liaison. |
| `INTERACTIVE` | Libellés de `none` / `switch` / `button` / `slider`. |
| `DISPLAY` | Libellés de `none` / `led` / `value` / `motor`. |
| `SHAPES` | Formes 3D proposées dans la liste. |
| `currentId` | Id de la définition en cours d'édition. |
| `testState` | `state` conservé entre deux exécutions de test. |

## Fonctions publiques

### `App.tabIndent(textarea)`
Fait insérer deux espaces par la touche `Tab` dans un `<textarea>`, puis émet `input`. Utilisée pour le programme et pour l'éditeur JSON.

### `Lib.renderList()`
Affiche la bibliothèque regroupée par catégorie (triées), avec pastille de couleur et nombre de pôles. L'élément édité est surligné.

### `Lib.select(id)`
Choisit la définition à éditer, vide `testState`, re-dessine la liste et le formulaire.

### `Lib.create()`
Ajoute une définition « Mon composant N » (catégorie `Perso`, pôles `IN` / `OUT`, `props: { V: 5 }`, programme d'exemple commenté), émet `change('library')` et l'ouvre.

### `Lib.renderEditor()`
Construit le formulaire de la définition courante (message d'aide s'il n'y en a pas) :
- colonne de gauche : nom, catégorie, couleur, description, nombre de pôles, table des pôles, interaction, affichage, forme 3D, `props` en JSON ;
- colonne de droite : aperçu SVG, programme, zone de test, boutons *placer sur le schéma*, *dupliquer*, *supprimer*.

Pour un composant `builtin`, les pôles et le programme sont désactivés et *supprimer* est masqué.

### `Lib.renderPreview()`
Dessine la définition seule dans l'aperçu (via `App.drawComponent`) avec 40 px de marge.

### `Lib.bindEditor(box, d)`
Branche les champs du formulaire sur la définition `d` :

| Champ | Événement | Effet |
|---|---|---|
| `[data-f]` (nom, catégorie, couleur, description, interaction, affichage, forme) | `input` / `change` | `d[champ] = valeur` ; formulaire reconstruit si l'interaction change (pour adapter la zone de test). |
| nombre de pôles | `change` | Ajoute des pôles `Pk` (nom libre suivant, côtés alternés gauche/droite, type `in`) ou tronque la liste ; `App.pruneWires()`. Borné entre 0 et 32. |
| nom de pôle | `change` | Refusé s'il est vide ou en double (toast). Sinon `App.renamePin` puis renommage. |
| côté / type de pôle | `change` | Mise à jour directe. |
| `×` d'un pôle | `click` | Retire le pôle ; `App.pruneWires()`. |
| `+ pôle` | `click` | Nombre de pôles + 1. |
| `props` JSON | `input` | Appliqué seulement si c'est un objet JSON valide ; sinon message `⚠`. |
| programme | `input` | `d.logic = code` (recompilé automatiquement par le simulateur). |
| ▶ exécuter / vider state | `click` | `runTest` / `testState = {}`. |
| placer sur le schéma | `click` | Onglet Schéma + `App.schemaView.addAt(d.id)`. |
| dupliquer | `click` | Copie profonde, nouvel id `perso_…`, nom « (copie) », sans `builtin`. |
| supprimer | `click` | Confirmation (indique le nombre d'instances), supprime les instances de toutes les plaques puis la définition. |

### `Lib.runTest(box, d)`
Lit les champs de test (vide = `null`), les contrôles `ui` et `t`, appelle `App.Sim.testLogic(d, inp, {}, ui, t, testState)`, conserve le `state` retourné et affiche sorties + état, ou l'erreur en rouge.

### `Lib.show()`
Appelée à l'ouverture de l'onglet : oublie `currentId` si la définition n'existe plus, re-dessine liste et formulaire.

## Fonctions privées

| Fonction | Rôle |
|---|---|
| `esc(s)` | Échappe `& < > "` pour l'insertion dans du HTML. |
| `opts(map, cur)` | Génère les `<option>` d'un `<select>` à partir d'un objet valeur → libellé. |
| `def()` | Définition en cours (`App.getDef(currentId)`). |
| `touched(structural)` | Après une modification : `App.changed('library')`, liste re-dessinée, puis formulaire complet (`structural`) ou seulement l'aperçu. |

## Écouteurs globaux

- Clic dans `#libList` → `Lib.select(id)`.
- `#btnNewComp` → `Lib.create()`.
