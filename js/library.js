/*
 * Bibliothèque de composants par défaut.
 *
 * Un composant (définition) :
 *  - pins     : liste de pôles { name, side: left|right|top|bottom, type: in|out|io|link }
 *               in  = lit la valeur du nœud, out = impose une valeur, io = les deux,
 *               link = connecteur entre plaques (fusionne les nœuds de même canal)
 *  - props    : paramètres par défaut, modifiables sur chaque instance
 *  - interactive : none | switch | button | slider  (contrôle dans le simulateur)
 *  - display  : none | led | value | motor           (retour visuel)
 *  - shape3d  : forme dans la vue 3D
 *  - w, h     : taille imposée sur le schéma (facultatif)
 *  - logic    : corps d'une fonction JS (inp, props, state, ui, t) => { pin: valeur }
 *               inp   : valeurs (V) des nœuds connectés à chaque pôle (null = flottant)
 *               state : mémoire persistante ; state.light (0..1), state.text, state.speed
 *               ui    : { on, pressed, value } selon le contrôle interactif
 *               t     : temps de simulation en secondes
 */
window.App = window.App || {};

App.DEFAULT_LIBRARY = [
  {
    id: 'battery', name: 'Pile', category: 'Alimentation', color: '#d64545',
    description: 'Source de tension continue. Le pôle + impose V volts, le pôle − impose 0 V.',
    pins: [{ name: '+', side: 'right', type: 'out' }, { name: '-', side: 'right', type: 'out' }],
    props: { V: 5 }, interactive: 'none', display: 'none', shape3d: 'cylinder',
    logic: "return { '+': props.V, '-': 0 };"
  },
  {
    id: 'gnd', name: 'Masse', category: 'Alimentation', color: '#888888', w: 60,
    description: 'Référence 0 V commune du circuit.',
    pins: [{ name: 'GND', side: 'top', type: 'out' }],
    props: {}, interactive: 'none', display: 'none', shape3d: 'box',
    logic: 'return { GND: 0 };'
  },
  {
    id: 'vcc', name: 'VCC', category: 'Alimentation', color: '#e67e22', w: 60,
    description: 'Rail d\'alimentation à tension fixe.',
    pins: [{ name: 'VCC', side: 'bottom', type: 'out' }],
    props: { V: 5 }, interactive: 'none', display: 'none', shape3d: 'box',
    logic: 'return { VCC: props.V };'
  },
  {
    id: 'switch', name: 'Interrupteur', category: 'Commandes', color: '#3fa7d6',
    description: 'Laisse passer la tension de A vers B lorsqu\'il est fermé. Cliquer pour basculer.',
    pins: [{ name: 'A', side: 'left', type: 'in' }, { name: 'B', side: 'right', type: 'out' }],
    props: {}, interactive: 'switch', display: 'none', shape3d: 'switch',
    logic: 'return { B: ui.on ? inp.A : null };'
  },
  {
    id: 'button', name: 'Bouton poussoir', category: 'Commandes', color: '#2e86c1',
    description: 'Contact momentané : A est relié à B tant que le bouton est maintenu.',
    pins: [{ name: 'A', side: 'left', type: 'in' }, { name: 'B', side: 'right', type: 'out' }],
    props: {}, interactive: 'button', display: 'none', shape3d: 'button',
    logic: 'return { B: ui.pressed ? inp.A : null };'
  },
  {
    id: 'pot', name: 'Potentiomètre', category: 'Commandes', color: '#8e44ad',
    description: 'Diviseur de tension réglable : OUT varie entre GND et VCC selon le curseur.',
    pins: [{ name: 'VCC', side: 'left', type: 'in' }, { name: 'GND', side: 'left', type: 'in' }, { name: 'OUT', side: 'right', type: 'out' }],
    props: {}, interactive: 'slider', display: 'none', shape3d: 'pot',
    logic: 'const lo = inp.GND || 0, hi = inp.VCC || 0;\nreturn { OUT: lo + (hi - lo) * ui.value };'
  },
  {
    id: 'clock', name: 'Horloge', category: 'Commandes', color: '#16a085',
    description: 'Génère un signal carré de fréquence freq (Hz).',
    pins: [{ name: 'OUT', side: 'right', type: 'out' }],
    props: { freq: 1, V: 5 }, interactive: 'none', display: 'led', shape3d: 'chip',
    logic: 'const high = Math.floor(t * props.freq * 2) % 2 === 1;\nstate.light = high ? 1 : 0;\nreturn { OUT: high ? props.V : 0 };'
  },
  {
    id: 'resistor', name: 'Résistance', category: 'Passifs', color: '#c8a165',
    description: 'Limite le courant. En simulation logique, transmet la tension de A vers B.',
    pins: [{ name: 'A', side: 'left', type: 'in' }, { name: 'B', side: 'right', type: 'out' }],
    props: { ohms: 220 }, interactive: 'none', display: 'none', shape3d: 'resistor',
    logic: 'return { B: inp.A };'
  },
  {
    id: 'led', name: 'LED', category: 'Sorties', color: '#ff3b3b',
    description: 'Diode électroluminescente : s\'allume quand A − K dépasse le seuil.',
    pins: [{ name: 'A', side: 'left', type: 'in' }, { name: 'K', side: 'right', type: 'in' }],
    props: { seuil: 1.8, couleur: '#ff3b3b' }, interactive: 'none', display: 'led', shape3d: 'led',
    logic: 'const v = (inp.A || 0) - (inp.K || 0);\nstate.light = v >= props.seuil ? Math.min(1, v / 5 + 0.3) : 0;\nreturn {};'
  },
  {
    id: 'motor', name: 'Moteur', category: 'Sorties', color: '#7f8c8d',
    description: 'Moteur à courant continu : la vitesse dépend de A − B, le signe donne le sens.',
    pins: [{ name: 'A', side: 'left', type: 'in' }, { name: 'B', side: 'right', type: 'in' }],
    props: { Vmax: 5 }, interactive: 'none', display: 'motor', shape3d: 'motor',
    logic: 'state.speed = ((inp.A || 0) - (inp.B || 0)) / props.Vmax;\nstate.text = Math.round(state.speed * 100) + \' %\';\nreturn {};'
  },
  {
    id: 'probe', name: 'Voltmètre', category: 'Mesure', color: '#f1c40f', w: 100,
    description: 'Affiche la tension du nœud connecté à IN (Z = flottant).',
    pins: [{ name: 'IN', side: 'left', type: 'in' }],
    props: {}, interactive: 'none', display: 'value', shape3d: 'probe',
    logic: "state.text = inp.IN == null ? 'Z' : inp.IN.toFixed(2) + ' V';\nreturn {};"
  },
  {
    id: 'and', name: 'Porte ET', category: 'Logique', color: '#27ae60',
    description: 'Y est haut si A et B sont hauts.',
    pins: [{ name: 'A', side: 'left', type: 'in' }, { name: 'B', side: 'left', type: 'in' }, { name: 'Y', side: 'right', type: 'out' }],
    props: { V: 5, seuil: 2.5 }, interactive: 'none', display: 'none', shape3d: 'chip',
    logic: 'const h = x => (x || 0) >= props.seuil;\nreturn { Y: h(inp.A) && h(inp.B) ? props.V : 0 };'
  },
  {
    id: 'or', name: 'Porte OU', category: 'Logique', color: '#27ae60',
    description: 'Y est haut si A ou B est haut.',
    pins: [{ name: 'A', side: 'left', type: 'in' }, { name: 'B', side: 'left', type: 'in' }, { name: 'Y', side: 'right', type: 'out' }],
    props: { V: 5, seuil: 2.5 }, interactive: 'none', display: 'none', shape3d: 'chip',
    logic: 'const h = x => (x || 0) >= props.seuil;\nreturn { Y: h(inp.A) || h(inp.B) ? props.V : 0 };'
  },
  {
    id: 'xor', name: 'Porte OU-X', category: 'Logique', color: '#27ae60',
    description: 'Y est haut si exactement une entrée est haute.',
    pins: [{ name: 'A', side: 'left', type: 'in' }, { name: 'B', side: 'left', type: 'in' }, { name: 'Y', side: 'right', type: 'out' }],
    props: { V: 5, seuil: 2.5 }, interactive: 'none', display: 'none', shape3d: 'chip',
    logic: 'const h = x => (x || 0) >= props.seuil;\nreturn { Y: h(inp.A) !== h(inp.B) ? props.V : 0 };'
  },
  {
    id: 'not', name: 'Inverseur', category: 'Logique', color: '#27ae60',
    description: 'Y est l\'inverse logique de A.',
    pins: [{ name: 'A', side: 'left', type: 'in' }, { name: 'Y', side: 'right', type: 'out' }],
    props: { V: 5, seuil: 2.5 }, interactive: 'none', display: 'none', shape3d: 'chip',
    logic: 'return { Y: (inp.A || 0) >= props.seuil ? 0 : props.V };'
  },
  {
    id: 'dff', name: 'Bascule D', category: 'Logique', color: '#1e8449',
    description: 'Mémorise D sur front montant de CLK. Exemple de composant avec mémoire (state).',
    pins: [{ name: 'D', side: 'left', type: 'in' }, { name: 'CLK', side: 'left', type: 'in' }, { name: 'Q', side: 'right', type: 'out' }, { name: 'nQ', side: 'right', type: 'out' }],
    props: { V: 5, seuil: 2.5 }, interactive: 'none', display: 'none', shape3d: 'chip',
    logic: 'const clk = (inp.CLK || 0) >= props.seuil;\nif (clk && !state.prev) state.q = (inp.D || 0) >= props.seuil;\nstate.prev = clk;\nreturn { Q: state.q ? props.V : 0, nQ: state.q ? 0 : props.V };'
  },
  {
    id: 'connector', name: 'Connecteur', category: 'Liaison', color: '#00e5ff', builtin: true, w: 40, h: 40,
    description: 'Relie ce point à tous les connecteurs du même canal, sur n\'importe quelle plaque du projet.',
    pins: [{ name: 'P', side: 'left', type: 'link' }],
    props: { canal: 'A' }, interactive: 'none', display: 'none', shape3d: 'connector',
    logic: 'return {};'
  }
];
