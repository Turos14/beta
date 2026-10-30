# Simulateur

Code : `js/sim.js` — référence complète dans [API sim.js](API-sim).

## Modèle

Le simulateur est **logique** : il propage des **tensions** de nœud en nœud, mais ne
calcule pas de courants ni de chutes de tension (pas de loi d'Ohm ni de Kirchhoff).
Cela suffit pour de la logique numérique, des commandes (interrupteurs, LED, moteurs) et
des diviseurs idéalisés comme le potentiomètre.

## 1. Construction des nœuds — `Sim.rebuild()`

Un **nœud** (*net*) est un ensemble de pôles électriquement reliés. Ils sont calculés par
**union-find** sur tout le projet :

1. Chaque pôle de chaque instance reçoit une clé `plaque/composant/pôle`.
2. Chaque fil fusionne ses deux extrémités. Une extrémité libre `{ x, y }` a pour clé
   `pt:<plaque>:<x>,<y>` : toutes les extrémités libres au même point d'une plaque se
   retrouvent donc dans le même nœud (**jonction**). Un fil dont l'autre bout est libre
   et isolé prolonge simplement le nœud de son pôle, sans rien relier d'autre.
3. Chaque pôle de type `link` (Connecteur) est fusionné avec un nœud virtuel
   `canal:<nom>`. Tous les connecteurs de même canal, **toutes plaques confondues**, se
   retrouvent donc dans le même nœud.
4. On obtient `Sim.pinNet` (clé de pôle → nœud) et `Sim.wireNet` (`plaque/fil` → nœud),
   ce qui permet de colorer chaque fil selon sa tension, même s'il n'a aucun pôle.

Au passage, chaque instance (sauf les connecteurs) est mise dans `Sim.items` avec sa
définition, ses `props` fusionnés et sa fonction compilée.

La reconstruction est paresseuse : toute modification du projet met `Sim.dirty = true`,
et `evaluate()` reconstruit au besoin.

## 2. Un pas de simulation — `Sim.evaluate()`

```
sorties ← sorties du pas précédent           (aucune source au tout premier pas)
répéter au plus 200 fois :
    tensions ← résoudre(sorties)              (une tension par nœud)
    pour chaque composant :
        inp   ← tension du nœud de chacun de ses pôles (null si aucun)
        state ← copie de l'état mémorisé au pas précédent
        out   ← logic(inp, props, state, ui, t)        (exceptions interceptées)
    si les nouvelles sorties sont identiques aux précédentes : stable, on s'arrête
    sorties ← nouvelles sorties
mémoriser : tensions, conflits, états (du dernier passage), erreurs
```

### Résolution d'un nœud

- Seuls les pôles `out` et `io` dont la valeur n'est pas `null` sont des **sources**.
- Aucune source → le nœud est **flottant** (`null`, affiché `Z`).
- Plusieurs sources → la **plus haute tension l'emporte** (comportement « OU câblé »). Si
  elles ne sont pas toutes égales, le nœud est marqué en **conflit** (`Sim.conflicts`,
  visible au survol du fil).

### Convergence

Chaque itération propage les signaux d'**une porte** de plus : un circuit qui enchaîne N
portes en série demande environ N itérations pour se stabiliser (42 pour le
[calculateur en portes](Exemple-calculateur-en-portes-logiques)).

Deux mécanismes rendent cela rapide :

- **démarrage à chaud** : chaque pas repart des sorties du pas précédent
  (`Sim.lastOutputs`). Si rien n'a changé, une seule itération suffit ; après un clic sur
  un interrupteur, seules les itérations nécessaires à la propagation sont faites. Les
  sorties mémorisées sont oubliées à chaque reconstruction des nœuds et à la réinitialisation ;
- **nœuds précalculés** : chaque composant connaît d'avance le nœud de chacun de ses pôles
  (`item.nets`).

L'itération s'arrête dès que plus aucune sortie ne change. Un circuit qui oscille (par
exemple un inverseur rebouclé sur lui-même) n'est jamais stable : on s'arrête alors au
bout de 200 itérations et le dernier résultat est utilisé.

`Sim.changed` indique si le pas a modifié une sortie, un état (`state`) ou un contrôle :
la vue du simulateur n'est redessinée que dans ce cas (ou si un moteur tourne).

### Mémoire (`state`)

Chaque passage reçoit une **copie** de l'état validé au pas précédent, et seul l'état du
dernier passage est conservé. Un composant appelé plusieurs fois dans le même pas voit
donc toujours le même `state` d'entrée : la détection de front (`Bascule D`) ne se
déclenche pas plusieurs fois.

## 3. Boucle temporelle

- `Sim.start()` lance une boucle `requestAnimationFrame`. À chaque image : `t += dt`
  (`dt` plafonné à 0,1 s), puis `evaluate()`, puis l'événement `sim`.
- `Sim.stop()` arrête la boucle. Simulation arrêtée, toute modification du projet ou
  interaction relance quand même un `evaluate()` ponctuel : la vue reste cohérente.
- `Sim.reset()` remet `t = 0` et vide les états, les contrôles, les tensions et les erreurs.

## 4. Interactions — `Sim.interact()`

| Interaction | Action | Effet sur `ui` |
|---|---|---|
| `switch` | `click` | `on = !on` |
| `button` | `down` / `up` | `pressed = true` / `false` |
| `slider` | `set`, valeur | `value = valeur` bornée à 0..1 |
| `slider` | `click` (3D) | `value` : 0 → 0,25 → 0,5 → 0,75 → 1 → 0 |

L'état `ui` de chaque instance est conservé dans `Sim.ui[clé]`, initialisé à
`{ on: false, pressed: false, value: 0.5 }`.

## Exemple : démo « Alimentation → Affichage »

```
[Pile +] ─ [Interrupteur A→B] ─ [Connecteur PWR]   ═══ canal PWR ═══   [Connecteur PWR] ─ [R1 A→B] ─ [LED A]
[Pile −] ─────────────────────── [Connecteur GND]   ═══ canal GND ═══   [Connecteur GND] ─────────── [LED K]
```

Interrupteur ouvert : `B` n'impose rien, donc le nœud PWR est flottant, `R1.B` aussi, et
la LED a `A − K = 0` : elle est éteinte. Interrupteur fermé : PWR = 5 V, `R1.B` = 5 V,
la LED a `5 − 0 ≥ 1,8` : elle s'allume avec `light = min(1, 5/5 + 0,3) = 1`.

## Limites connues

- Pas de courant : une LED sans résistance s'allume quand même ; un court-circuit n'est
  signalé que comme un conflit de tensions.
- Les composants sont **orientés** (une résistance transmet de `A` vers `B` seulement).
- La résolution « max » ne modélise pas une sortie qui tire vers 0 V contre une autre à 5 V.
