# Format du projet JSON

C'est le format du bouton `télécharger`, de l'onglet JSON et de la sauvegarde locale.

## Vue d'ensemble

```json
{
  "name": "Démo",
  "version": 1,
  "library": [ /* définitions de composants */ ],
  "schematics": [ /* plaques */ ]
}
```

| Clé | Type | Obligatoire | Description |
|---|---|---|---|
| `name` | string | non (défaut `"Projet"`) | Nom du projet. |
| `version` | number | non | Version du format, toujours forcée à `1`. |
| `library` | array | non (défaut : bibliothèque par défaut) | Définitions de composants. |
| `schematics` | array | non (défaut : une plaque vide) | Plaques / schémas. |

## Définition de composant (`library[]`)

```json
{
  "id": "and",
  "name": "Porte ET",
  "category": "Logique",
  "color": "#27ae60",
  "description": "Y est haut si A et B sont hauts.",
  "pins": [
    { "name": "A", "side": "left",  "type": "in"  },
    { "name": "B", "side": "left",  "type": "in"  },
    { "name": "Y", "side": "right", "type": "out" }
  ],
  "props": { "V": 5, "seuil": 2.5 },
  "interactive": "none",
  "display": "none",
  "shape3d": "chip",
  "logic": "const h = x => (x || 0) >= props.seuil;\nreturn { Y: h(inp.A) && h(inp.B) ? props.V : 0 };"
}
```

| Clé | Type | Valeurs | Défaut si absent |
|---|---|---|---|
| `id` | string | unique dans la bibliothèque | **obligatoire** |
| `name` | string | | `id` |
| `category` | string | | `"Perso"` |
| `color` | string | couleur CSS `#rrggbb` | `"#33ff66"` |
| `description` | string | | `""` |
| `pins[].name` | string | unique dans le composant | **obligatoire** |
| `pins[].side` | string | `left` `right` `top` `bottom` | `left` |
| `pins[].type` | string | `in` `out` `io` `link` | `in` |
| `props` | object | valeurs libres | `{}` |
| `interactive` | string | `none` `switch` `button` `slider` | `none` |
| `display` | string | `none` `led` `value` `motor` | `none` |
| `shape3d` | string | voir [Programmer un composant](Programmer-un-composant#formes-3d-shape3d) | `chip` |
| `logic` | string | corps de fonction JS | `"return {};"` |
| `w`, `h` | number | taille en px sur le schéma | calculée |
| `builtin` | boolean | composant système verrouillé | absent |

Si la bibliothèque ne contient pas de composant `connector`, il est ajouté automatiquement.

## Plaque (`schematics[]`)

```json
{
  "id": "sch_alim",
  "name": "Alimentation",
  "components": [
    { "id": "bat", "type": "battery", "x": 60, "y": 100, "rot": 0, "label": "Pile 5V", "props": {} },
    { "id": "cpwr", "type": "connector", "x": 340, "y": 70, "rot": 0, "label": "", "props": { "canal": "PWR" } }
  ],
  "wires": [
    { "id": "w2", "a": { "c": "sw", "p": "B" }, "b": { "c": "cpwr", "p": "P" } }
  ]
}
```

### Plaque

| Clé | Type | Défaut |
|---|---|---|
| `id` | string | généré (`sch_xxxxxx`) |
| `name` | string | `"Plaque N"` |
| `components` | array | `[]` |
| `wires` | array | `[]` |

### Instance de composant (`components[]`)

| Clé | Type | Description | Défaut |
|---|---|---|---|
| `id` | string | Unique dans la plaque. | généré (`c_xxxxxx`) |
| `type` | string | `id` d'une définition de `library`. | **obligatoire** |
| `x`, `y` | number | Coin supérieur gauche (px, avant rotation). | `0` |
| `rot` | number | Rotation horaire : `0`, `90`, `180`, `270`. | `0` |
| `label` | string | Étiquette affichée (sinon le nom de la définition). | — |
| `props` | object | Surcharge des `props` de la définition. | `{}` |

Une instance dont le `type` n'existe pas dans la bibliothèque est affichée `? type` en
rouge sur le schéma et ignorée par la simulation et la 3D.

### Fil (`wires[]`)

```json
{ "id": "w1", "a": { "c": "bat", "p": "+" }, "b": { "x": 300, "y": 200 },
  "pts": [[120, -40], [160, 60]], "color": "#ff4d4d" }
```

| Clé | Type | Description |
|---|---|---|
| `id` | string | Généré si absent (`w_xxxxxx`). |
| `a` | extrémité | Extrémité 1. |
| `b` | extrémité | Extrémité 2. |
| `pts` | `[[x, y], …]` | Facultatif. **Points de passage** dans l'ordre, de `a` vers `b`. Absent = tracé automatique. |
| `color` | string | Facultatif. Couleur CSS du fil (`#rrggbb`). Absent = couleur du thème. |

Une **extrémité** est soit :
- un **pôle** : `{ "c": "<id composant>", "p": "<nom du pôle>" }` ;
- un **point libre** : `{ "x": 300, "y": 200 }` (coordonnées du schéma, multiples de 10 conseillés).

Un fil appartient à **une seule plaque**. Les extrémités libres situées exactement au même
point d'une plaque sont électriquement reliées (jonction). Les fils dont une extrémité est
invalide sont supprimés au chargement, ainsi que les points de passage non numériques. Le
tracé complet n'est pas stocké : il est recalculé à l'affichage à partir de `a`, `pts` et `b`.

Les liaisons **entre plaques** ne sont pas des fils : ce sont des instances de `connector`
portant la même valeur `props.canal`.

## Validation au chargement

`App.normalizeProject` est appelée à l'import, à l'application du JSON et au démarrage.
Elle complète les valeurs manquantes (tableaux ci-dessus) et refuse le projet, avec un
message explicite, si :

- la racine n'est pas un objet ;
- une définition n'a pas d'`id` texte (`library[3] : champ "id" manquant`) ;
- un pôle n'a pas de `name` texte ;
- une instance n'a pas de `type` texte (`Affichage : components[2] sans "type"`).

## Éditer à la main : conseils

- Ajouter un composant à une plaque : copier une entrée de `components`, changer `id`, `x`, `y`.
- Créer une nouvelle définition : copier une entrée de `library` et changer son `id`.
- Recolorer tous les fils d'alimentation : ajouter `"color": "#ff4d4d"` aux fils concernés.
- Renommer un pôle **en JSON** ne met pas à jour les fils : modifier aussi `wires[].a.p` / `b.p`
  (l'éditeur de composants, lui, le fait automatiquement).
- Le JSON doit rester strict : guillemets doubles, pas de virgule finale, pas de commentaires.
  Dans `logic`, les retours à la ligne s'écrivent `\n` et les guillemets doubles `\"`.
