# Circuit 3D — Wiki

Application web pour dessiner des schémas de circuits électroniques, créer et
**programmer ses propres composants**, simuler le circuit et le visualiser en **3D**
sous forme de plaques reliées entre elles.

- Application en ligne : https://turos14.github.io/beta/
- Code source : https://github.com/Turos14/beta
- Technologies : HTML, CSS, JavaScript « vanilla » (aucune étape de build), [Three.js r128](https://threejs.org/) pour la 3D.

## Sommaire

### Utilisation
- [Prise en main](Prise-en-main) — les 5 onglets, raccourcis, plusieurs plaques
- [Composants de base](Composants-de-base) — tous les composants fournis et leur code
- [Programmer un composant](Programmer-un-composant) — API `inp / props / state / ui / t`, exemples

### Technique
- [Architecture](Architecture) — fichiers, ordre de chargement, événements, flux de données
- [Format du projet JSON](Format-du-projet-JSON) — structure complète du fichier
- [Simulateur](Simulateur) — algorithme de calcul des nœuds et des tensions
- Référence de l'API, fichier par fichier :
  - [model.js](API-model) — projet, géométrie, sauvegarde
  - [sim.js](API-sim) — simulateur
  - [schematic.js](API-schematic) — rendu et édition SVG
  - [library-editor.js](API-library-editor) — éditeur de composants
  - [view3d.js](API-view3d) — vue 3D
  - [json-editor.js](API-json-editor) — édition JSON
  - [app.js](API-app) — interface et contrôleur
- [Déploiement](Deploiement) — GitHub Pages et synchronisation du wiki

## En une minute

1. Onglet **Schéma** : cliquer un composant dans la palette, puis cliquer un pôle et un autre pôle pour poser un fil.
2. Onglet **Simulateur** : `▶ simuler`, puis cliquer sur les interrupteurs et boutons.
3. Onglet **Vue 3D** : voir les plaques, tourner autour, cliquer sur les composants interactifs.
4. Onglet **Composants** : `+ nouveau composant`, choisir le nombre de pôles, écrire son programme, `▶ exécuter` pour le tester.
5. `télécharger` pour récupérer le projet en `.json`.
