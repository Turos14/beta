# Prise en main

## Barre du haut

| Élément | Rôle |
|---|---|
| Nom du projet | Champ éditable à côté du logo, enregistré dans le JSON (`name`). |
| Onglets | Schéma · Composants · Vue 3D · Simulateur · JSON |
| `nouveau` | Demande « vide » ou « demo » puis remplace le projet courant. |
| `importer` | Charge un fichier `.json` (il est validé avant d'être chargé). |
| `télécharger` | Enregistre le projet dans `<nom_du_projet>.json`. |

Le projet est aussi **sauvegardé automatiquement** dans le navigateur (`localStorage`,
clé `circuit3d.project`), 300 ms après chaque modification. Cette sauvegarde est propre à
l'appareil et au navigateur : utiliser `télécharger` / `importer` pour changer d'appareil.

## Plaques (plusieurs schémas par projet)

La colonne de gauche liste les **plaques** du projet. Chaque plaque est un schéma
indépendant, qui devient une plaque (PCB) dans la vue 3D.

| Action | Comment |
|---|---|
| Ajouter | `+ nouveau schéma` |
| Ouvrir | clic sur le nom |
| Renommer | `✎` ou double-clic |
| Réordonner | `↑` (l'ordre détermine l'empilement en 3D) |
| Supprimer | `×` (il reste toujours au moins une plaque) |

### Relier des plaques entre elles

Poser un composant **Connecteur** (catégorie *Liaison*) sur chaque plaque et leur donner
le **même canal** (propriété `canal`, ex. `PWR`, `GND`, `DATA`). Tous les connecteurs d'un
même canal forment un seul nœud électrique, quelle que soit leur plaque :

- dans le simulateur, la tension passe d'une plaque à l'autre ;
- dans la vue 3D, un câble coloré relie les plaques ;
- l'inspecteur (rien de sélectionné) affiche la liste des liaisons inter-plaques.

## Onglet Schéma

| Action | Souris / tactile | Clavier |
|---|---|---|
| Ajouter un composant | clic dans la palette (au centre de la vue) ou glisser-déposer | — |
| Déplacer | glisser le composant (aimanté sur une grille de 10 px) | — |
| Câbler | clic sur un pôle, puis clic sur un autre pôle | `Échap` annule |
| Sélectionner un fil | clic sur le fil | — |
| Pivoter de 90° | bouton `pivoter` | `R` |
| Supprimer | bouton `supprimer` | `Suppr` / `Retour arrière` |
| Zoomer | molette, ou pincement à deux doigts | — |
| Se déplacer | glisser le fond | — |
| Recentrer | bouton `recentrer` | — |

L'**inspecteur** à droite permet de modifier l'étiquette et les paramètres (`props`) du
composant sélectionné, de voir ses pôles et le nombre de fils reliés à chacun.

## Onglet Composants

Liste de la bibliothèque à gauche, éditeur à droite. Voir
[Programmer un composant](Programmer-un-composant) pour le détail de chaque champ.

## Onglet Vue 3D

| Action | Contrôle |
|---|---|
| Tourner | clic gauche + glisser |
| Déplacer | clic droit + glisser |
| Zoomer | molette |
| Disposition | menu `empilées` / `côte à côte` |
| Interagir | clic sur un interrupteur (bascule), un bouton (maintenir) ou un potentiomètre (+25 % par clic) |

Pendant la simulation : les LED s'allument, les moteurs tournent, les pistes et les câbles
s'éclairent selon la tension, les voltmètres affichent leur valeur.

## Onglet Simulateur

- `▶ simuler` / `■ arrêter` : lance ou arrête la boucle de simulation (≈ 60 pas/s).
- `réinitialiser` : remet le temps à 0, vide la mémoire (`state`) et les contrôles.
- Clic sur un interrupteur pour le basculer, appui maintenu sur un bouton, glisser un potentiomètre.
- Le panneau de droite regroupe les contrôles et afficheurs de **toutes** les plaques, et les erreurs d'exécution des programmes.

Couleur des fils : **vert vif** = tension > 0,5 V, **vert sombre** = 0 V,
**pointillé gris** = flottant (aucune source). Survoler un fil affiche sa tension.

## Onglet JSON

Affiche le projet complet en JSON. On peut le modifier directement :

- la validité est vérifiée en direct (ligne/colonne de l'erreur) ;
- `appliquer` (ou `Ctrl+S`) remplace le projet par le JSON édité ;
- `formater` ré-indente le texte ;
- `recharger depuis le projet` abandonne les modifications.

Format détaillé : [Format du projet JSON](Format-du-projet-JSON).
