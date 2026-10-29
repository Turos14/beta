# Beta — Éditeur de circuits 3D

Application web (HTML / CSS / JS, sans build) pour dessiner des schémas de circuits
électroniques, créer ses propres composants, les simuler et les voir en 3D.
Thème terminal : fond noir, texte vert, police de VS Code.

Documentation complète (composants, programmation, API de chaque fichier) :
[wiki du projet](https://github.com/Turos14/beta/wiki) — sources dans [`wiki/`](wiki/).

## Installer l'application

Sur https://turos14.github.io/beta/, bouton **⤓ installer l'app** : l'application
s'installe sur ordinateur ou téléphone (PWA) et fonctionne hors ligne.

## Lancer en local

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

La vue 3D charge Three.js depuis un CDN (connexion internet requise).

## Fonctionnalités

| Onglet | Rôle |
|---|---|
| **Schéma** | Éditeur 2D : palette à gauche (clic ou glisser-déposer), clic pôle → pôle pour câbler (clics intermédiaires = points de passage, double-clic = extrémité libre, couleur au choix), `R` pivoter, `Suppr` effacer, molette / pincement pour zoomer. |
| **Composants** | Créer ses composants : nom, rôle (« à quoi sert-il »), nombre de pôles, côté et type de chaque pôle, paramètres, forme 3D, contrôle interactif, affichage, et **programme JS** testable sur place. |
| **Vue 3D** | Chaque schéma = une plaque (empilées ou côte à côte), câbles entre plaques, LED / moteurs / afficheurs animés pendant la simulation, composants cliquables. |
| **Simulateur** | Tensions en direct sur les fils, interrupteurs, boutons, potentiomètres ; toutes les plaques sont simulées ensemble. |
| **JSON** | Voir / modifier le projet en JSON (validation en direct, `Ctrl+S` pour appliquer). |

Plusieurs schémas par projet : liste « plaques » à gauche. Pour relier deux plaques,
placer un **Connecteur** sur chacune avec le même **canal** (ex. `PWR`).

Boutons `télécharger` / `importer` : export et import du projet en `.json`.
Le projet est aussi sauvegardé automatiquement dans le navigateur.

## Programmer un composant

Le code est le corps d'une fonction `(inp, props, state, ui, t)` qui retourne les
valeurs imposées sur les sorties :

```js
// inp   : tension de chaque pôle (null = flottant)
// props : paramètres du composant
// state : mémoire persistante — state.light (0..1), state.text, state.speed
// ui    : { on, pressed, value } selon le contrôle interactif
// t     : temps de simulation (s)
const h = (inp.A || 0) > 2.5;
state.light = h ? 1 : 0;
return { Y: h ? props.V : 0 };
```

Types de pôles : `in` (lit), `out` (impose), `io` (les deux), `link` (connecteur).

## Hébergement

Le workflow `.github/workflows/pages.yml` vérifie les scripts et publie le site sur
GitHub Pages à chaque push sur `main`. À activer une fois dans
*Settings → Pages → Source : GitHub Actions*.

## Structure

```
index.html
manifest.webmanifest  manifeste PWA (installation)
sw.js                 service worker (hors ligne)
icons/                logo et icônes
css/style.css
js/library.js         composants par défaut
js/model.js           projet, géométrie, sauvegarde
js/sim.js             simulateur
js/schematic.js       éditeur / vue SVG
js/library-editor.js  éditeur de composants
js/view3d.js          vue 3D (Three.js)
js/json-editor.js     édition JSON
js/app.js             interface
```
