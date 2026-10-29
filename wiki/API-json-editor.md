# API — `js/json-editor.js`

Onglet **JSON** : voir et modifier le projet complet. Objet public : **`App.JsonEditor`** (alias interne `J`).

## Variables internes

| Nom | Contenu |
|---|---|
| `ta` | `<textarea id="jsonEditor">`. |
| `status` | Zone de statut `#jsonStatus`. |
| `edited` | `true` dès que l'utilisateur a modifié le texte (le texte n'est alors plus écrasé à l'ouverture de l'onglet). |
| `timer` | Délai de la validation en direct (250 ms). |

## Fonctions publiques

### `J.reload()`
Remplace le texte par `JSON.stringify(App.project, null, 2)` et remet `edited` à `false`. Statut : « synchronisé avec le projet ». Appelée aussi à chaque chargement de projet (événement `project`).

### `J.show()`
À l'ouverture de l'onglet : `reload()`, sauf si des modifications sont en cours.

### `J.apply()`
Parse et valide le texte (`parse`). En cas d'erreur : statut rouge + toast. Sinon arrête la simulation, `App.setProject(obj, true)` (garde la plaque courante si possible), recharge le texte normalisé et affiche « JSON appliqué au projet ». Raccourci : `Ctrl+S` / `Cmd+S` dans la zone de texte.

### `J.format()`
Ré-indente le texte (2 espaces) s'il est valide, sans l'appliquer.

## Fonctions privées

### `setStatus(text, cls)`
Met à jour le statut ; `cls` vaut `'ok'` (vert), `'err'` (rouge) ou vide (neutre).

### `locate(msg) → string`
Si le message d'erreur du navigateur contient `position N`, le convertit en ` (ligne L, col C)`.

### `parse() → { obj } | { error }`
`JSON.parse` du texte, puis `App.normalizeProject` sur une **copie**, pour signaler aussi les erreurs de structure (id manquant, etc.) sans toucher au projet.

## Écouteurs

| Élément | Événement | Effet |
|---|---|---|
| zone de texte | `Tab` | indentation (`App.tabIndent`) |
| zone de texte | `input` | `edited = true`, validation 250 ms plus tard : « JSON valide — modifications non appliquées » ou erreur |
| zone de texte | `Ctrl/Cmd+S` | `apply()` |
| `appliquer` / `formater` / `recharger depuis le projet` | `click` | `apply()` / `format()` / `reload()` |
