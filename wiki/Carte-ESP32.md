# Carte ESP32 (Arduino C++, WiFi)

Le composant **ESP32 DevKit** (catégorie *Microcontrôleur*) est une carte programmable en
**C++ Arduino**, avec **WiFi intégré**. Chaque carte posée a **son propre programme** et
**ses propres broches**, choisies dans l'inspecteur.

> Le programme ne passe pas par un vrai compilateur : un sous-ensemble du C++ Arduino est
> traduit en JavaScript dans le navigateur (voir [API arduino.js](API-arduino)). Les croquis
> habituels (setup / loop, variables, tableaux, fonctions, `String`, `Serial`, WiFi, UDP)
> fonctionnent tels quels ; les classes, pointeurs et interruptions ne sont pas pris en charge.

## Mise en route

1. Onglet **Schéma** → palette *Microcontrôleur* → **ESP32 DevKit**.
2. Inspecteur → **broches de la carte** : cocher les broches à faire apparaître, choisir leur
   côté (gauche / droite). `toutes`, `aucune`, `par défaut` règlent tout d'un coup. Retirer une
   broche supprime les fils qui y étaient branchés.
3. Inspecteur → **✎ éditer le programme** : écrire le croquis (ou partir d'un **exemple**),
   `vérifier`, puis `enregistrer`. La carte redémarre avec le nouveau programme.
4. Onglet **Simulateur** → `▶ simuler`. Le panneau de droite montre les **réseaux WiFi** et un
   **moniteur série** par carte (champ « envoyer » : le texte arrive dans `Serial`, suivi de `\n`).

L'inspecteur indique `✓ N lignes` ou `⚠ erreur` (survoler pour le message). Les erreurs de
compilation et d'exécution s'affichent aussi dans le moniteur série et dans la zone *Erreurs*.

## Broches

Une broche `Dn` correspond au GPIO `n` : `pinMode(18, OUTPUT)` pilote la broche **D18**.

| Broche | Type | Remarque |
|---|---|---|
| `3V3` | sortie | 3,3 V en permanence |
| `GND` | sortie | 0 V |
| `VIN` | entrée | alimentation 5 V (sans effet en simulation) |
| `D0` `D2` `D4` `D5` `D12`…`D19` `D21`…`D23` `D25`…`D27` `D32` `D33` | entrée / sortie | `D2` = LED intégrée (bleue en 3D), `D1` / `D3` = TX0 / RX0, `D25` / `D26` = DAC |
| `D34` `D35` `D36` (VP) `D39` (VN) | entrée seule | `pinMode(34, OUTPUT)` provoque une erreur |

Par défaut, la carte posée a 16 broches : `3V3 GND D34 D35 D32 D33 D25 D26` à gauche,
`D23 D22 D21 D19 D18 D5 D4 D2` à droite.

**Logique 3,3 V** : une sortie `HIGH` impose 3,3 V ; `digitalRead` renvoie `HIGH` à partir de
1,65 V. Une sortie à 3,3 V commande donc les portes logiques de la bibliothèque (seuil 2,5 V).

| Mode | Broche non reliée (flottante) | Remarque |
|---|---|---|
| `INPUT` | `LOW` | |
| `INPUT_PULLUP` | `HIGH` | idéal pour un bouton entre la broche et `GND` |
| `INPUT_PULLDOWN` | `LOW` | |
| `OUTPUT` | — | `digitalRead` relit la valeur écrite |

`analogRead` renvoie 0…4095 pour 0…3,3 V. `analogWrite(p, 0…255)`, `dacWrite`,
`ledcAttach` / `ledcWrite` imposent la **tension moyenne** du signal PWM (une LED ou un
moteur réagissent proportionnellement).

## Exécution et temps

- `setup()` s'exécute une fois, puis `loop()` en boucle. `millis()` / `micros()` suivent le
  temps du simulateur.
- `delay(ms)` suspend le programme sans bloquer la page ; les autres cartes et le circuit
  continuent.
- Une boucle qui tourne sans `delay` (attente active, `while (digitalRead(…))`) rend la main au
  simulateur toutes les 20 000 itérations : les entrées sont relues à l'image suivante.
- Les entrées sont lues dans l'**état stable de l'image précédente** : une sortie écrite puis
  relue par un fil dans le même tour de `loop()` n'apparaît qu'au tour suivant.
- `réinitialiser` (simulateur) redémarre tous les programmes. Arrêter puis relancer la
  simulation reprend là où le programme en était.

## WiFi

Les cartes qui appellent `WiFi.begin("ssid", "mot de passe")` avec le **même SSID** forment un
réseau, **quelles que soient leurs plaques** (pas de fil ni de connecteur à poser).

- La connexion prend 0,5 s (`WiFi.status()` passe à `WL_CONNECTED`).
- Adresses : `192.168.1.100`, `.101`… dans l'ordre de connexion ; `WiFi.config(IPAddress(…))`
  impose une adresse fixe.
- Le mot de passe est celui de la première carte du réseau (ou du point d'accès) ; une carte
  avec un autre mot de passe reste en `WL_CONNECT_FAILED`.
- `WiFi.softAP("ssid", "mdp")` crée un point d'accès d'adresse `192.168.4.1` ; les cartes qui
  le rejoignent reçoivent `192.168.4.2`, `.3`…
- Sur la carte, le schéma et la 3D affichent `WiFi 192.168.1.100` (ou `AP …`, `WiFi…`,
  `WiFi refusé`).

Les échanges passent par **WiFiUDP** : `beginPacket(ip, port)` + `print` + `endPacket()` pour
envoyer, `parsePacket()` + `readString()` (ou `read(buf, taille)`) pour recevoir. Une adresse
finissant par `.255` (ou `WiFi.broadcastIP()`) envoie à toutes les autres cartes du réseau.
Un paquet est reçu par les sockets ouvertes avec `udp.begin(port)` sur ce port ; chaque socket
garde au plus 64 paquets en attente.

`WiFiClient`, `WebServer`, `HTTPClient` (TCP / HTTP) ne sont pas simulés.

## Exemple : bouton sur une plaque, LED sur une autre

Projet prêt à importer : [`examples/esp32-wifi.json`](https://github.com/Turos14/beta/blob/main/examples/esp32-wifi.json) (bouton `importer`).

Plaque 1 : bouton entre `D4` et une masse, carte avec l'exemple **WiFi : émetteur UDP**.
Plaque 2 : résistance + LED entre `D18` et une masse, carte avec l'exemple
**WiFi : récepteur UDP**. En simulation, appuyer sur le bouton allume la LED de l'autre plaque ;
le moniteur série du récepteur affiche `reçu de 192.168.1.100 : ON`.

```cpp
// Récepteur (extrait)
WiFiUDP udp;

void setup() {
  pinMode(18, OUTPUT);
  WiFi.begin("atelier", "12345678");
  while (WiFi.status() != WL_CONNECTED) delay(100);
  udp.begin(4210);
}

void loop() {
  if (udp.parsePacket()) {
    String msg = udp.readString();
    digitalWrite(18, msg == "ON" ? HIGH : LOW);
  }
  delay(10);
}
```

## C++ pris en charge

| Élément | Détails |
|---|---|
| Types | `int long short unsigned char byte word bool float double String size_t uint8_t…int32_t`, `const`, `static` (variables locales conservées entre deux appels), `enum` |
| Entiers | les affectations et `return` des variables / fonctions entières tronquent (`int x = 7 / 2;` → 3) ; les calculs intermédiaires restent décimaux |
| Tableaux | `int t[5];`, `int t[] = {1, 2, 3};`, tableaux 2D, `sizeof(t) / sizeof(t[0])` |
| Fonctions | avec paramètres et valeurs par défaut, appelables avant leur définition ; prototypes ignorés |
| Contrôle | `if else switch for while do…while break continue return`, opérateurs C, ternaire, casts `(int)` `(float)` `(char)` |
| Préprocesseur | `#include` ignoré ; `#define NOM valeur` → constante (pas de macro avec paramètres) |
| `char` | un caractère `'A'` vaut son code (65) ; `Serial.print('A')` affiche `A`, `(char)65` donne le texte `"A"` |
| `String` | `+`, `+=`, `==`, `length() indexOf() substring() charAt() toInt() toFloat() equals() startsWith() endsWith()`, `trim() toUpperCase() toLowerCase() replace()` (modifient la chaîne) |
| Serial | `begin print println printf write available read peek readString readStringUntil parseInt parseFloat` ; `print(x, HEX)`, `print(x, 2)` (base pour un entier, décimales pour un réel) |
| Arduino | `pinMode digitalRead digitalWrite analogRead analogReadMilliVolts analogWrite dacWrite ledcAttach ledcWrite millis micros delay delayMicroseconds map constrain min max abs sq sqrt pow sin cos… random randomSeed bitRead bit lowByte highByte F()` |
| Constantes | `HIGH LOW INPUT OUTPUT INPUT_PULLUP INPUT_PULLDOWN LED_BUILTIN (2) A0 (36)… DAC1 DAC2 PI DEC HEX OCT BIN WL_*` |

Non pris en charge : `struct`, `class`, `template`, `new` / `delete`, pointeurs (sauf
`const char*` traité comme du texte), références (`&` ignoré : passage par valeur),
`attachInterrupt`, `Servo`, `Wire` / `SPI`, `EEPROM` / `Preferences`, TCP / HTTP. Un `float`
entier s'affiche sans décimales (`Serial.println(2.0)` → `2`).
