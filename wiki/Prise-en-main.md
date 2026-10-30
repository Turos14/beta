# Prise en main

## Installer l'application

Bouton **`⤓ installer l'app`** en haut à droite. L'application s'installe comme une app
classique (icône sur le bureau ou l'écran d'accueil, fenêtre dédiée) et fonctionne
**hors ligne**, 3D comprise, après une première visite en ligne.

| Appareil | Comment |
|---|---|
| Chrome / Edge (ordinateur, Android) | le bouton ouvre directement la fenêtre d'installation du navigateur |
| iPhone / iPad | Safari → **Partager** → **Sur l'écran d'accueil** (le bouton affiche ces étapes) |
| Safari Mac | **Fichier** → **Ajouter au Dock** |
| Firefox ordinateur | pas d'installation d'app web : utiliser Chrome ou Edge |

Les mises à jour de l'application sont récupérées automatiquement au lancement, dès qu'une
connexion est disponible. Une fois installée, l'app garde ses projets dans son propre
stockage : utiliser `télécharger` / `importer` pour passer un projet du navigateur à l'app.

Autre option : télécharger le code source
([.zip](https://github.com/Turos14/beta/archive/refs/heads/main.zip)) et ouvrir `index.html`.

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
- dans la vue 3D, un câble coloré relie les plaques (case **câbles entre plaques** pour les masquer) ;
- l'inspecteur (rien de sélectionné) affiche la liste des liaisons inter-plaques ;
- dans le schéma et le simulateur, la case **liaisons** affiche ces liens (voir ci-dessous).

Chaque canal a sa propre couleur, identique en 2D et en 3D.

### Afficher les liaisons (schéma et simulateur)

Case **liaisons** dans la barre d'outils du schéma ou du simulateur (les deux sont liées) :

- les connecteurs de même canal sur la plaque affichée sont reliés en **pointillés** (chacun
  au plus proche, pour rester lisible) ;
- sous chaque connecteur relié à **d'autres plaques**, une étiquette `→ Plaque` les liste
  (au-delà de deux : `→ A, B +3`). **Cliquer** sur l'étiquette ouvre la plaque suivante du canal ;
- dans le simulateur, les pointillés sont vifs et épais quand le canal est sous tension,
  estompés sinon.

### Isoler un canal (clic sur un connecteur)

Cliquer sur un **connecteur** n'affiche plus que son canal :

| Vue | Effet |
|---|---|
| Schéma | sélectionner le connecteur suffit ; les fils de son nœud électrique sont épaissis, les autres fils et les composants qui n'y sont pas reliés sont estompés ; ses liaisons s'affichent même si la case **liaisons** est décochée |
| Simulateur | même rendu ; un 2ᵉ clic sur un connecteur du même canal réaffiche tout |
| Vue 3D | seuls les câbles de ce canal restent visibles (et s'allument), même si **câbles entre plaques** est décoché |

Un clic dans le vide ou `Échap` réaffiche tout. Le canal isolé est le même dans les trois
vues : isoler `PWR` dans le schéma puis ouvrir la 3D ne montre que les câbles `PWR`.

## Onglet Schéma

| Action | Souris / tactile | Clavier |
|---|---|---|
| Ajouter un composant | clic dans la palette (au centre de la vue) ou glisser-déposer | — |
| Déplacer | glisser le composant (aimanté sur une grille de 10 px) | — |
| Câbler | clic sur un pôle, puis clic sur un autre pôle | `Échap` annule |
| Sélectionner un fil | clic sur le fil | — |
| Couleur des nouveaux fils | menu `fil` de la barre d'outils | — |
| Pivoter de 90° | bouton `pivoter` | `R` |
| Supprimer | bouton `supprimer` | `Suppr` / `Retour arrière` |
| Zoomer | molette, ou pincement à deux doigts | — |
| Se déplacer | glisser le fond | — |
| Recentrer | bouton `recentrer` | — |

### Câbles : couleur, tracé, extrémité libre

**Pendant le câblage** (après un clic sur un pôle) :

| Geste | Effet |
|---|---|
| clic sur le fond | pose un **point de passage** : le fil passera par là, avec des coudes à angle droit |
| glisser le fond | déplace la vue sans interrompre le câblage |
| clic sur un pôle | termine le fil sur ce pôle |
| clic sur un carré (extrémité libre d'un autre fil) | termine le fil sur ce point : les deux fils sont **reliés** (jonction, point plein) |
| double-clic sur le fond | termine le fil à cet endroit, en **extrémité libre** |
| bouton `terminer le fil` ou `Entrée` | termine le fil sur le dernier point posé (extrémité libre) ; pratique sur mobile |
| `Échap` | annule le fil en cours |

On peut aussi **commencer** un fil depuis une extrémité libre en cliquant sur son carré.

**Fil sélectionné** (clic dessus) :

| Geste | Effet |
|---|---|
| glisser un point rond | déplace ce point de passage |
| double-clic sur un point rond | retire ce point |
| double-clic sur le fil | ajoute un point de passage à cet endroit |
| glisser un carré (extrémité libre) | déplace l'extrémité ; lâchée sur un pôle, elle s'y **branche** |
| inspecteur → couleur | sélecteur libre, 8 couleurs prédéfinies, ou `défaut` (couleur du thème) |
| inspecteur → `+ point de passage` | ajoute un point au milieu du tracé |
| inspecteur → `tracé auto` | supprime tous les points de passage |

Un fil sans point de passage suit un **tracé automatique** en trois segments. Deux fils
qui se croisent ne sont **pas** reliés ; ils ne le sont que si leurs extrémités libres
sont au même point (point plein dessiné).

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
| Câbles entre plaques | case à cocher : affiche / masque les câbles reliant les connecteurs de même canal |
| Assombrissement | case à cocher : brouillard qui assombrit les objets éloignés ; décocher pour tout voir avec la même luminosité |
| Interagir | clic sur un interrupteur (bascule), un bouton (maintenir) ou un potentiomètre (+25 % par clic) |

Pendant la simulation : les LED s'allument, les moteurs tournent, les pistes et les câbles
s'éclairent selon la tension, les voltmètres affichent leur valeur.

## Onglet Simulateur

- `▶ simuler` / `■ arrêter` : lance ou arrête la boucle de simulation (≈ 60 pas/s).
- `réinitialiser` : remet le temps à 0, vide la mémoire (`state`) et les contrôles.
- Clic sur un interrupteur pour le basculer, appui maintenu sur un bouton, glisser un potentiomètre.
- Le panneau de droite regroupe les contrôles et afficheurs de **toutes** les plaques, et les erreurs d'exécution des programmes.

Couleur des fils : **vert vif** = tension > 0,5 V, **vert sombre** = 0 V,
**pointillé gris** = flottant (aucune source). Un fil coloré garde sa couleur : il est
plein quand il est sous tension, et estompé à 0 V ou s'il est flottant. Survoler un fil
affiche sa tension.

## Options d'affichage mémorisées

Les cases **liaisons**, **câbles entre plaques** et **assombrissement** sont mémorisées dans le
navigateur (clé `circuit3d.prefs`), indépendamment du projet : elles ne sont pas dans le JSON.
Par défaut : liaisons masquées, câbles 3D et assombrissement activés.

## Onglet JSON

Affiche le projet complet en JSON. On peut le modifier directement :

- la validité est vérifiée en direct (ligne/colonne de l'erreur) ;
- `appliquer` (ou `Ctrl+S`) remplace le projet par le JSON édité ;
- `formater` ré-indente le texte ;
- `recharger depuis le projet` abandonne les modifications.

Format détaillé : [Format du projet JSON](Format-du-projet-JSON).
