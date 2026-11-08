# API — `js/arduino.js`

Cartes programmables en C++ Arduino (ESP32) et WiFi simulé. Objet public : **`App.Arduino`**.
Utilisation : [Carte ESP32](Carte-ESP32).

## Principe

1. **Transpilation** : le programme C++ est découpé en jetons puis réécrit en JavaScript
   (`transpile`). Les déclarations typées deviennent des `let` / `const`, chaque fonction
   devient un **générateur** (`function*`) et chaque appel d'une fonction du programme ou de
   `delay` devient `(yield* f(…))`. Les boucles reçoivent un point de contrôle
   `if (__tick()) yield 0;`.
2. **Compilation** : le code obtenu est enveloppé dans `new Function(<noms de l'API>, …)` :
   l'API Arduino (`pinMode`, `Serial`, `WiFi`…) est passée en paramètres, sans variable globale.
3. **Exécution** : un `Runtime` par carte fait avancer le générateur jusqu'au temps du
   simulateur (`run(t)`). Un `yield d` (d > 0, en secondes) est une attente (`delay`) ; un
   `yield 0` rend la main jusqu'à l'image suivante.

## Fonctions publiques

### `App.Arduino.transpile(code) → string`
Traduit un programme C++ en JavaScript (corps de générateur). Lève une `Error` en français, avec
le numéro de ligne (`e.cppLine`), pour une construction non prise en charge ou mal formée.

Transformations principales :

| C++ | JavaScript |
|---|---|
| `int x = a / b;` | `let x = __i(a / b);` (troncature des entiers à l'affectation et au `return`) |
| `x /= 2;` (x entier) | `x = __i(x / (2));` |
| `const char* s = "a";` | `const s = "a";` |
| `int t[3];` / `int t[] = {1, 2};` | `let t = __arr([3], () => 0);` / `let t = [1, 2];` |
| `WiFiUDP udp;` / `IPAddress ip(1, 2, 3, 4);` | `let udp = new WiFiUDP();` / `let ip = new IPAddress(1, 2, 3, 4);` |
| `void f(int a) { … }` | `function* f(a) { … }` (prototypes supprimés) |
| `f(1);` / `delay(100);` | `(yield* f(1));` / `(yield* delay(100));` |
| `static int n = 0;` (local) | variable globale cachée `__stN_n`, initialisée une seule fois |
| `#define LED 2` | `const LED = 2;` |
| `enum E { A, B = 5, C };` | `const A = 0, B = 5, C = (B) + 1;` |
| `(int) x`, `(char) c` | `__i(x)`, `__chr(c)` |
| `'A'` | `65` (texte `"A"` s'il est le seul argument de `print` / `println`) |
| `s.length()` | `s.length` |
| `s.trim();` (instruction) | `s = s.trim();` (idem `toUpperCase`, `toLowerCase`, `replace` → `replaceAll`) |
| `"a" "b"` | `"a" + "b"` |
| `->`, `::` | `.` |
| `NULL`, `nullptr` | `null` |

Les identifiants valides en C++ mais réservés en JavaScript (`function`, `let`, `var`, `in`…)
reçoivent un `_` final. Les numéros de ligne sont conservés (les lignes ajoutées le sont sur
la même ligne), ce qui permet de localiser les erreurs.

### `App.Arduino.check(code) → string | null`
Transpile et compile sans exécuter : `null` si le programme est valide, sinon le message
d'erreur. Les erreurs de syntaxe JavaScript sont localisées par `syntaxLine`.

### `App.Arduino.syntaxLine(js) → number`
Ligne d'une erreur de syntaxe du code généré. `new Function` ne la donne pas : le code est
placé (sans être exécuté) dans un `<script>` dont l'événement `error` de la page indique la
ligne. Renvoie `0` hors navigateur.

### `App.Arduino.attach(it)`
Appelée par `Sim.rebuild` pour chaque élément de `Sim.items` dont la définition a `mcu`.
Réutilise le `Runtime` de la carte si son code n'a pas changé, sinon en crée un nouveau.
Définit `it.rt` et remplace `it.fn` par une fonction qui écrit `state.text` (état WiFi) et
`state.light` (LED GPIO2), lève l'erreur du programme s'il y en a une, et renvoie `rt.out`.

### `App.Arduino.sync(items) → items[]`
Fin de `Sim.rebuild` : garde la liste des cartes (réseau WiFi) et oublie les programmes des
cartes supprimées. Renvoie les cartes (`Sim.mcus`).

### `App.Arduino.reset()`
Oublie tous les programmes (appelée par `Sim.reset`) : ils redémarrent au prochain `rebuild`.

### `App.Arduino.runtime(key) → Runtime | null`
Programme d'une carte (`key` = `Sim.compKey(boardId, compId)`).

### `App.Arduino.codeOf(comp, def) → string`
Programme d'une instance : `comp.code`, sinon `def.code`.

### `App.Arduino.networks() → { [ssid]: [key…] }`
Réseaux WiFi : cartes connectées (avec une adresse) par SSID.

### `App.Arduino.ssids() → string[]`
SSID utilisés par les cartes (pour `WiFi.scanNetworks` / `WiFi.SSID(i)`).

### `App.Arduino.EXAMPLES`
Exemples de l'éditeur : `[{ name, code }]` (`code: null` = programme par défaut de la carte).

### `App.Arduino.GPIO`, `App.Arduino.INPUT_ONLY`
Numéros de GPIO existants sur l'ESP32 DevKit, et ceux en entrée seule (34, 35, 36, 39).

## `Runtime`

`new App.Arduino.Runtime(it, code)` — `it` : `{ key, board: { id }, comp: { id } }`.

| Propriété | Description |
|---|---|
| `pins` | `{ [gpio]: { mode: 'in' \| 'pullup' \| 'pulldown' \| 'out', v } }` |
| `out` | Sorties imposées : `{ '3V3': 3.3, GND: 0, D<n>: tension }` (broches en `OUTPUT`) |
| `serial` | Texte écrit sur `Serial` (20 000 derniers caractères) |
| `rx` | Texte reçu du moniteur série, lu par `Serial.read…` |
| `now`, `wake` | Temps du programme et date de reprise après un `delay` (s) |
| `error` | Message d'erreur (`compilation : …` ou `exécution : …`) ; le programme s'arrête |
| `wifi`, `ip`, `staticIp` | `{ ssid, pass, ap, at }`, adresse attribuée, adresse imposée par `WiFi.config` |
| `sockets` | Sockets `WiFiUDP` du programme (`port`, file `q` des paquets reçus) |
| `js` | Code JavaScript généré |

| Méthode | Rôle |
|---|---|
| `run(t)` | Avance jusqu'à `t` : reprend le générateur tant que `wake ≤ t`. S'arrête sur `yield 0` (boucle sans attente : plus de 20 000 tours de boucle dans l'image) ou après 5 000 reprises. |
| `volts(p)` | Tension lue sur la broche : sortie → sa valeur ; sinon `Sim.valueAt(…, 'D' + p)`, et une entrée flottante vaut 3,3 V en `INPUT_PULLUP`, 0 sinon. |
| `setOut(p, v)` / `refreshOut()` | Passe la broche en sortie à `v` volts / recalcule `out`. |
| `gpio(p, forOutput)` | État de la broche ; erreur si elle n'existe pas, ou si elle est en entrée seule et `forOutput`. |
| `wifiStatus()` | `WL_CONNECTED` après 0,5 s si le mot de passe correspond à celui du réseau (point d'accès, sinon première carte du SSID) ; attribue l'adresse à la première connexion. |
| `sendUdp(host, port, fromPort, data)` | Dépose le paquet dans les sockets ouvertes sur `port` des cartes connectées au même SSID dont l'adresse est `host` (ou toutes si `host` finit par `.255`). |
| `label()` | Texte affiché : `WiFi —`, `WiFi…`, `WiFi 192.168.1.100`, `AP 192.168.4.1`, `WiFi refusé`, `erreur`. |
| `api()` | Objet des fonctions et constantes offertes au programme (Arduino, `Serial`, `WiFi`, `WiFiUDP`, `IPAddress`, aides `__i`, `__chr`, `__arr`, `__sizeof`, `__tick`). |

Les erreurs JavaScript courantes sont traduites (`x is not defined` → `« x » n'est pas
déclaré`…) et complétées du numéro de ligne tiré de la pile d'appels.

## Méthodes ajoutées à `String.prototype`

`toInt`, `toFloat`, `toDouble`, `equals`, `equalsIgnoreCase`, `c_str`, `compareTo`,
`isEmpty` — non énumérables, seulement si absentes.
