/*
 * Modèle du projet : état, événements, géométrie des composants, sauvegarde locale.
 *
 * Projet :
 *  { name, version, library: [définitions], schematics: [ { id, name, components, wires } ] }
 *  composant (instance) : { id, type, x, y, rot, label, props }
 *  fil                  : { id, a: { c: idComposant, p: nomPôle }, b: { c, p } }
 * Les plaques sont reliées entre elles par les connecteurs de même canal.
 */
(function () {
  const STORAGE_KEY = 'circuit3d.project';
  const GRID = 10;
  const PIN_STEP = 20;
  const listeners = {};

  App.GRID = GRID;
  App.state = { boardId: null, selection: null };

  // ---- Événements ----
  App.on = (evt, fn) => { (listeners[evt] = listeners[evt] || []).push(fn); };
  App.emit = (evt, data) => { (listeners[evt] || []).forEach(fn => fn(data)); };

  App.uid = (prefix) => (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 8);
  App.clone = (o) => JSON.parse(JSON.stringify(o));
  App.snap = (v) => Math.round(v / GRID) * GRID;

  // ---- Accès ----
  App.getDef = (type) => App.project.library.find(d => d.id === type);
  App.board = () => App.project.schematics.find(s => s.id === App.state.boardId) || App.project.schematics[0];
  App.findComp = (board, id) => board.components.find(c => c.id === id);
  App.compProps = (comp, def) => Object.assign({}, def ? def.props : {}, comp.props || {});

  // ---- Géométrie ----
  const SIDE_DIR = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };

  App.defGeom = function (def) {
    const by = { left: [], right: [], top: [], bottom: [] };
    (def.pins || []).forEach(p => (by[p.side] || by.left).push(p));
    const vert = Math.max(by.left.length, by.right.length);
    const horiz = Math.max(by.top.length, by.bottom.length);
    // def.w / def.h permettent d'imposer une taille (multiples de 20 conseillés)
    const w = +def.w || Math.max((horiz + 1) * PIN_STEP, 80);
    const h = +def.h || Math.max((vert + 1) * PIN_STEP, 40);
    const pins = [];
    Object.keys(by).forEach(side => {
      const list = by[side], n = list.length;
      list.forEach((p, i) => {
        const off = (i - (n - 1) / 2) * PIN_STEP;
        let x, y;
        if (side === 'left') { x = 0; y = h / 2 + off; }
        else if (side === 'right') { x = w; y = h / 2 + off; }
        else if (side === 'top') { x = w / 2 + off; y = 0; }
        else { x = w / 2 + off; y = h; }
        pins.push({ name: p.name, type: p.type, side, x, y, dir: SIDE_DIR[side] });
      });
    });
    return { w, h, pins };
  };

  // Rotation (sens horaire en coordonnées écran) d'un vecteur
  App.rotVec = function (dx, dy, rot) {
    switch (((rot || 0) % 360 + 360) % 360) {
      case 90: return [-dy, dx];
      case 180: return [-dx, -dy];
      case 270: return [dy, -dx];
      default: return [dx, dy];
    }
  };

  // Position monde d'un pôle et direction sortante
  App.pinWorld = function (comp, pinName) {
    const def = App.getDef(comp.type);
    if (!def) return null;
    const g = App.defGeom(def);
    const pin = g.pins.find(p => p.name === pinName);
    if (!pin) return null;
    const [rx, ry] = App.rotVec(pin.x - g.w / 2, pin.y - g.h / 2, comp.rot);
    const dir = App.rotVec(pin.dir[0], pin.dir[1], comp.rot);
    return { x: comp.x + g.w / 2 + rx, y: comp.y + g.h / 2 + ry, dir };
  };

  // Tracé orthogonal d'un fil : liste de points
  App.wirePath = function (board, wire) {
    const ca = App.findComp(board, wire.a.c), cb = App.findComp(board, wire.b.c);
    if (!ca || !cb) return null;
    const A = App.pinWorld(ca, wire.a.p), B = App.pinWorld(cb, wire.b.p);
    if (!A || !B) return null;
    return App.routePoints(A, B);
  };

  App.routePoints = function (A, B) {
    const S = GRID;
    const p1 = [A.x + A.dir[0] * S, A.y + A.dir[1] * S];
    const p2 = B.dir ? [B.x + B.dir[0] * S, B.y + B.dir[1] * S] : [B.x, B.y];
    const pts = [[A.x, A.y], p1];
    if (Math.abs(p2[0] - p1[0]) >= Math.abs(p2[1] - p1[1])) {
      const mx = App.snap((p1[0] + p2[0]) / 2);
      pts.push([mx, p1[1]], [mx, p2[1]]);
    } else {
      const my = App.snap((p1[1] + p2[1]) / 2);
      pts.push([p1[0], my], [p2[0], my]);
    }
    pts.push(p2, [B.x, B.y]);
    return pts;
  };

  App.boardBounds = function (board) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    board.components.forEach(c => {
      const def = App.getDef(c.type); if (!def) return;
      const g = App.defGeom(def);
      const cx = c.x + g.w / 2, cy = c.y + g.h / 2;
      const r = Math.max(g.w, g.h) / 2 + 10;
      x0 = Math.min(x0, cx - r); y0 = Math.min(y0, cy - r);
      x1 = Math.max(x1, cx + r); y1 = Math.max(y1, cy + r);
    });
    if (!isFinite(x0)) return { x: 0, y: 0, w: 400, h: 300 };
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };

  // ---- Modifications du projet ----
  let saveTimer = null;
  App.changed = function (reason) {
    App.emit('change', reason);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(App.saveLocal, 300);
  };

  App.saveLocal = function () {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(App.project)); } catch (e) { /* stockage indisponible */ }
  };

  App.loadLocal = function () {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  };

  // Vérifie et complète un projet (import, JSON édité…). Lève une erreur lisible si invalide.
  App.normalizeProject = function (p) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('le projet doit être un objet JSON');
    const out = {
      name: typeof p.name === 'string' ? p.name : 'Projet',
      version: 1,
      library: Array.isArray(p.library) ? p.library : App.clone(App.DEFAULT_LIBRARY),
      schematics: Array.isArray(p.schematics) ? p.schematics : []
    };
    out.library.forEach((d, i) => {
      if (!d || typeof d.id !== 'string') throw new Error('library[' + i + '] : champ "id" manquant');
      d.name = d.name || d.id;
      d.pins = Array.isArray(d.pins) ? d.pins : [];
      d.pins.forEach((pin, j) => {
        if (!pin || typeof pin.name !== 'string') throw new Error('library[' + i + '].pins[' + j + '] : champ "name" manquant');
        pin.side = ['left', 'right', 'top', 'bottom'].includes(pin.side) ? pin.side : 'left';
        pin.type = ['in', 'out', 'io', 'link'].includes(pin.type) ? pin.type : 'in';
      });
      d.props = d.props && typeof d.props === 'object' ? d.props : {};
      d.color = d.color || '#33ff66';
      d.category = d.category || 'Perso';
      d.description = d.description || '';
      d.interactive = d.interactive || 'none';
      d.display = d.display || 'none';
      d.shape3d = d.shape3d || 'chip';
      d.logic = typeof d.logic === 'string' ? d.logic : 'return {};';
    });
    if (!out.library.some(d => d.id === 'connector')) {
      out.library.push(App.clone(App.DEFAULT_LIBRARY.find(d => d.id === 'connector')));
    }
    if (!out.schematics.length) out.schematics.push({ id: App.uid('sch'), name: 'Plaque 1', components: [], wires: [] });
    out.schematics.forEach((s, i) => {
      s.id = s.id || App.uid('sch');
      s.name = s.name || 'Plaque ' + (i + 1);
      s.components = Array.isArray(s.components) ? s.components : [];
      s.wires = Array.isArray(s.wires) ? s.wires : [];
      s.components.forEach((c, j) => {
        if (!c || typeof c.type !== 'string') throw new Error(s.name + ' : components[' + j + '] sans "type"');
        c.id = c.id || App.uid('c');
        c.x = +c.x || 0; c.y = +c.y || 0; c.rot = +c.rot || 0;
        c.props = c.props && typeof c.props === 'object' ? c.props : {};
      });
      s.wires = s.wires.filter(w => w && w.a && w.b);
      s.wires.forEach(w => { w.id = w.id || App.uid('w'); });
    });
    return out;
  };

  App.setProject = function (p, keepBoard) {
    App.project = App.normalizeProject(p);
    if (!keepBoard || !App.project.schematics.some(s => s.id === App.state.boardId)) {
      App.state.boardId = App.project.schematics[0].id;
    }
    App.state.selection = null;
    App.emit('project');
    App.changed('project');
  };

  App.addBoard = function (name) {
    const b = { id: App.uid('sch'), name: name || 'Plaque ' + (App.project.schematics.length + 1), components: [], wires: [] };
    App.project.schematics.push(b);
    App.state.boardId = b.id;
    App.changed('board');
    return b;
  };

  App.addComponent = function (board, type, x, y) {
    const def = App.getDef(type);
    if (!def) return null;
    const c = { id: App.uid('c'), type, x: App.snap(x), y: App.snap(y), rot: 0, label: '', props: {} };
    if (type === 'connector') c.props.canal = 'A';
    board.components.push(c);
    App.changed('comp');
    return c;
  };

  App.removeComponent = function (board, id) {
    board.components = board.components.filter(c => c.id !== id);
    board.wires = board.wires.filter(w => w.a.c !== id && w.b.c !== id);
    App.changed('comp');
  };

  App.addWire = function (board, a, b) {
    if (a.c === b.c && a.p === b.p) return null;
    const dup = board.wires.some(w =>
      (w.a.c === a.c && w.a.p === a.p && w.b.c === b.c && w.b.p === b.p) ||
      (w.a.c === b.c && w.a.p === b.p && w.b.c === a.c && w.b.p === a.p));
    if (dup) return null;
    const w = { id: App.uid('w'), a, b };
    board.wires.push(w);
    App.changed('wire');
    return w;
  };

  // Garde les fils cohérents quand on renomme / supprime un pôle d'une définition
  App.renamePin = function (type, oldName, newName) {
    App.project.schematics.forEach(s => {
      const ids = new Set(s.components.filter(c => c.type === type).map(c => c.id));
      s.wires.forEach(w => {
        ['a', 'b'].forEach(k => { if (ids.has(w[k].c) && w[k].p === oldName) w[k].p = newName; });
      });
    });
  };
  App.pruneWires = function () {
    App.project.schematics.forEach(s => {
      s.wires = s.wires.filter(w => {
        const ca = App.findComp(s, w.a.c), cb = App.findComp(s, w.b.c);
        if (!ca || !cb) return false;
        const da = App.getDef(ca.type), db = App.getDef(cb.type);
        return da && db && da.pins.some(p => p.name === w.a.p) && db.pins.some(p => p.name === w.b.p);
      });
    });
  };

  // Liaisons inter-plaques : canal -> [{ board, comp }]
  App.channels = function () {
    const map = {};
    App.project.schematics.forEach(s => s.components.forEach(c => {
      if (c.type !== 'connector') return;
      const ch = String(App.compProps(c, App.getDef(c.type)).canal || '?');
      (map[ch] = map[ch] || []).push({ board: s, comp: c });
    }));
    return map;
  };

  // ---- Projet de démonstration ----
  App.demoProject = function () {
    const b1 = { id: 'sch_alim', name: 'Alimentation', components: [
      { id: 'bat', type: 'battery', x: 60, y: 100, rot: 0, label: 'Pile 5V', props: {} },
      { id: 'sw', type: 'switch', x: 200, y: 60, rot: 0, label: 'Marche', props: {} },
      { id: 'cpwr', type: 'connector', x: 340, y: 70, rot: 0, label: '', props: { canal: 'PWR' } },
      { id: 'cgnd', type: 'connector', x: 340, y: 150, rot: 0, label: '', props: { canal: 'GND' } },
      { id: 'pv', type: 'probe', x: 200, y: 160, rot: 0, label: 'V sortie', props: {} }
    ], wires: [
      { id: 'w1', a: { c: 'bat', p: '+' }, b: { c: 'sw', p: 'A' } },
      { id: 'w2', a: { c: 'sw', p: 'B' }, b: { c: 'cpwr', p: 'P' } },
      { id: 'w3', a: { c: 'bat', p: '-' }, b: { c: 'cgnd', p: 'P' } },
      { id: 'w4', a: { c: 'sw', p: 'B' }, b: { c: 'pv', p: 'IN' } }
    ] };
    const b2 = { id: 'sch_aff', name: 'Affichage', components: [
      { id: 'cp2', type: 'connector', x: 40, y: 60, rot: 0, label: '', props: { canal: 'PWR' } },
      { id: 'r1', type: 'resistor', x: 120, y: 50, rot: 0, label: 'R1', props: {} },
      { id: 'led1', type: 'led', x: 240, y: 50, rot: 0, label: 'LED rouge', props: {} },
      { id: 'cg2', type: 'connector', x: 360, y: 60, rot: 180, label: '', props: { canal: 'GND' } },
      { id: 'pot', type: 'pot', x: 100, y: 160, rot: 0, label: 'Vitesse', props: {} },
      { id: 'mot', type: 'motor', x: 240, y: 170, rot: 0, label: 'Moteur', props: {} },
      { id: 'cp3', type: 'connector', x: 20, y: 150, rot: 0, label: '', props: { canal: 'PWR' } },
      { id: 'cg3', type: 'connector', x: 360, y: 180, rot: 180, label: '', props: { canal: 'GND' } },
      { id: 'cg4', type: 'connector', x: 20, y: 200, rot: 0, label: '', props: { canal: 'GND' } }
    ], wires: [
      { id: 'w5', a: { c: 'cp2', p: 'P' }, b: { c: 'r1', p: 'A' } },
      { id: 'w6', a: { c: 'r1', p: 'B' }, b: { c: 'led1', p: 'A' } },
      { id: 'w7', a: { c: 'led1', p: 'K' }, b: { c: 'cg2', p: 'P' } },
      { id: 'w8', a: { c: 'cp3', p: 'P' }, b: { c: 'pot', p: 'VCC' } },
      { id: 'w9', a: { c: 'cg4', p: 'P' }, b: { c: 'pot', p: 'GND' } },
      { id: 'w10', a: { c: 'pot', p: 'OUT' }, b: { c: 'mot', p: 'A' } },
      { id: 'w11', a: { c: 'mot', p: 'B' }, b: { c: 'cg3', p: 'P' } }
    ] };
    const b3 = { id: 'sch_log', name: 'Logique', components: [
      { id: 'clk', type: 'clock', x: 40, y: 60, rot: 0, label: 'CLK 1Hz', props: {} },
      { id: 'bt', type: 'button', x: 40, y: 150, rot: 0, label: 'Bouton', props: {} },
      { id: 'vcc', type: 'vcc', x: 0, y: 100, rot: 0, label: '', props: {} },
      { id: 'g1', type: 'and', x: 180, y: 90, rot: 0, label: 'ET', props: {} },
      { id: 'led2', type: 'led', x: 300, y: 100, rot: 0, label: 'LED verte', props: { couleur: '#33ff66' } },
      { id: 'gnd3', type: 'gnd', x: 400, y: 130, rot: 0, label: '', props: {} }
    ], wires: [
      { id: 'w12', a: { c: 'vcc', p: 'VCC' }, b: { c: 'bt', p: 'A' } },
      { id: 'w13', a: { c: 'clk', p: 'OUT' }, b: { c: 'g1', p: 'A' } },
      { id: 'w14', a: { c: 'bt', p: 'B' }, b: { c: 'g1', p: 'B' } },
      { id: 'w15', a: { c: 'g1', p: 'Y' }, b: { c: 'led2', p: 'A' } },
      { id: 'w16', a: { c: 'led2', p: 'K' }, b: { c: 'gnd3', p: 'GND' } }
    ] };
    return { name: 'Démo', version: 1, library: App.clone(App.DEFAULT_LIBRARY), schematics: [b1, b2, b3] };
  };

  App.emptyProject = function () {
    return { name: 'Nouveau projet', version: 1, library: App.clone(App.DEFAULT_LIBRARY), schematics: [] };
  };
})();
