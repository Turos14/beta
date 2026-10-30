/*
 * Simulateur logique / tensions.
 *
 * Tous les pôles reliés par des fils (et les connecteurs de même canal, toutes plaques
 * confondues) forment un nœud. Les extrémités libres de fils posées au même point
 * d'une plaque sont reliées entre elles (jonction). À chaque pas, chaque composant lit la tension de ses
 * nœuds d'entrée et impose une valeur sur ses sorties via son code `logic`. On itère
 * jusqu'à stabilité. Plusieurs sorties sur un même nœud : la plus haute l'emporte
 * (et le nœud est signalé en conflit). Un nœud sans source est flottant (null).
 * Chaque pas repart des sorties du pas précédent : après un changement, le circuit se
 * restabilise en quelques itérations, même s'il enchaîne de nombreuses portes.
 */
(function () {
  const MAX_ITER = 200;
  const compiled = {};

  const Sim = App.Sim = {
    running: false,
    t: 0,
    ui: {},         // clé composant -> { on, pressed, value }
    states: {},     // clé composant -> état mémorisé (state)
    pinNet: {},     // clé pôle -> id de nœud
    wireNet: {},    // "plaque/fil" -> id de nœud
    netVal: {},     // id de nœud -> tension | null
    conflicts: {},  // id de nœud -> true
    errors: {},     // clé composant -> message d'erreur
    lastOutputs: null, // sorties du dernier état stable (point de départ du pas suivant)
    changed: true,  // le dernier pas a modifié des sorties, des états ou un contrôle (à redessiner)
    dirty: true
  };

  const compKey = (boardId, compId) => boardId + '/' + compId;
  const pinKey = (boardId, compId, pin) => boardId + '/' + compId + '/' + pin;
  Sim.compKey = compKey;
  // Clé d'une extrémité de fil : pôle, ou point libre de la plaque
  const endKey = (boardId, e) => App.isPinEnd(e) ? pinKey(boardId, e.c, e.p) : 'pt:' + boardId + ':' + e.x + ',' + e.y;

  Sim.compile = function (def) {
    const cache = compiled[def.id];
    if (cache && cache.code === def.logic) return cache.fn;
    let fn;
    try {
      fn = new Function('inp', 'props', 'state', 'ui', 't', def.logic || 'return {};');
    } catch (e) {
      fn = () => { throw new Error('erreur de syntaxe : ' + e.message); };
    }
    compiled[def.id] = { code: def.logic, fn };
    return fn;
  };

  Sim.uiFor = function (key) {
    return Sim.ui[key] || (Sim.ui[key] = { on: false, pressed: false, value: 0.5 });
  };

  // Construit les nœuds (union-find) pour tout le projet
  Sim.rebuild = function () {
    const parent = {};
    const find = (k) => {
      if (parent[k] === undefined) parent[k] = k;
      while (parent[k] !== k) { parent[k] = parent[parent[k]]; k = parent[k]; }
      return k;
    };
    const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };

    Sim.items = [];
    App.project.schematics.forEach(s => {
      s.components.forEach(c => {
        const def = App.getDef(c.type);
        if (!def) return;
        const props = App.compProps(c, def);
        def.pins.forEach(p => {
          const k = pinKey(s.id, c.id, p.name);
          find(k);
          if (p.type === 'link') union(k, 'canal:' + String(props.canal));
        });
        if (def.id !== 'connector') {
          Sim.items.push({ key: compKey(s.id, c.id), board: s, comp: c, def, props, fn: Sim.compile(def) });
        }
      });
      s.wires.forEach(w => union(endKey(s.id, w.a), endKey(s.id, w.b)));
    });
    Sim.pinNet = {};
    Object.keys(parent).forEach(k => { if (!k.startsWith('canal:') && !k.startsWith('pt:')) Sim.pinNet[k] = find(k); });
    // Nœud de chaque pôle, précalculé pour la boucle de simulation
    Sim.items.forEach(it => { it.nets = it.def.pins.map(p => Sim.pinNet[pinKey(it.board.id, it.comp.id, p.name)]); });
    Sim.wireNet = {};
    App.project.schematics.forEach(s => s.wires.forEach(w => { Sim.wireNet[s.id + '/' + w.id] = find(endKey(s.id, w.a)); }));
    Sim.lastOutputs = null;
    Sim.dirty = false;
  };

  function normalizeOut(v, props) {
    if (v === true) return +props.V || 5;
    if (v === false) return 0;
    if (v === null || v === undefined || v === '') return null;
    const n = +v;
    return isFinite(n) ? n : null;
  }

  function netsFromOutputs(outputs) {
    const drivers = {};
    Sim.items.forEach(it => {
      const out = outputs[it.key];
      if (!out) return;
      it.def.pins.forEach((p, i) => {
        if (p.type !== 'out' && p.type !== 'io') return;
        const v = out[p.name];
        if (v === null || v === undefined) return;
        const net = it.nets[i];
        (drivers[net] = drivers[net] || []).push(v);
      });
    });
    const vals = {}, conflicts = {};
    Object.keys(drivers).forEach(net => {
      const d = drivers[net];
      vals[net] = Math.max.apply(null, d);
      if (d.some(v => Math.abs(v - d[0]) > 1e-6)) conflicts[net] = true;
    });
    return { vals, conflicts };
  }

  // Calcule un état stable du circuit au temps t
  Sim.evaluate = function () {
    if (Sim.dirty) Sim.rebuild();
    let outputs = Sim.lastOutputs || {}, nets = { vals: {}, conflicts: {} }, newStates = {};
    let changed = !Sim.lastOutputs;
    const errors = {};
    for (let iter = 0; iter < MAX_ITER; iter++) {
      nets = netsFromOutputs(outputs);
      const next = {};
      newStates = {};
      Sim.items.forEach(it => {
        const inp = {};
        it.def.pins.forEach((p, i) => {
          const v = nets.vals[it.nets[i]];
          inp[p.name] = v === undefined ? null : v;
        });
        const state = Object.assign({}, Sim.states[it.key]);
        let ret = {};
        try {
          ret = it.fn(inp, it.props, state, Sim.uiFor(it.key), Sim.t) || {};
        } catch (e) {
          errors[it.key] = e.message;
        }
        const out = {};
        Object.keys(ret).forEach(k => { out[k] = normalizeOut(ret[k], it.props); });
        next[it.key] = out;
        newStates[it.key] = state;
      });
      const same = JSON.stringify(next) === JSON.stringify(outputs);
      if (!same) changed = true;
      outputs = next;
      if (same) break;
    }
    Sim.lastOutputs = outputs;
    Sim.netVal = nets.vals;
    Sim.conflicts = nets.conflicts;
    if (!changed && JSON.stringify(newStates) !== JSON.stringify(Sim.states)) changed = true;
    Sim.changed = changed;
    Sim.states = newStates;
    Sim.errors = errors;
  };

  Sim.valueAt = function (boardId, compId, pin) {
    const net = Sim.pinNet[pinKey(boardId, compId, pin)];
    const v = Sim.netVal[net];
    return v === undefined ? null : v;
  };
  Sim.netOf = (boardId, compId, pin) => Sim.pinNet[pinKey(boardId, compId, pin)];
  Sim.wireValue = function (boardId, wireId) {
    const v = Sim.netVal[Sim.wireNet[boardId + '/' + wireId]];
    return v === undefined ? null : v;
  };
  Sim.wireConflict = (boardId, wireId) => !!Sim.conflicts[Sim.wireNet[boardId + '/' + wireId]];
  Sim.stateOf = (boardId, compId) => Sim.states[compKey(boardId, compId)] || {};

  // ---- Boucle ----
  let last = 0, raf = 0;
  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    Sim.t += dt;
    Sim.evaluate();
    App.emit('sim');
    raf = requestAnimationFrame(loop);
  }

  Sim.start = function () {
    if (Sim.running) return;
    Sim.running = true;
    Sim.dirty = true;
    last = performance.now();
    raf = requestAnimationFrame(loop);
    App.emit('simstate');
  };
  Sim.stop = function () {
    Sim.running = false;
    cancelAnimationFrame(raf);
    App.emit('simstate');
  };
  Sim.toggle = () => (Sim.running ? Sim.stop() : Sim.start());
  Sim.reset = function () {
    Sim.t = 0; Sim.states = {}; Sim.ui = {}; Sim.netVal = {}; Sim.errors = {}; Sim.lastOutputs = null;
    Sim.dirty = true;
    if (!Sim.running) Sim.evaluate();
    Sim.changed = true;
    App.emit('sim');
  };

  // Action utilisateur sur un composant interactif
  Sim.interact = function (boardId, compId, action, value) {
    const comp = App.findComp(App.project.schematics.find(s => s.id === boardId), compId);
    const def = comp && App.getDef(comp.type);
    if (!def) return;
    const ui = Sim.uiFor(compKey(boardId, compId));
    if (def.interactive === 'switch' && action === 'click') ui.on = !ui.on;
    if (def.interactive === 'button') ui.pressed = action === 'down';
    if (def.interactive === 'slider') {
      if (action === 'set') ui.value = Math.max(0, Math.min(1, value));
      if (action === 'click') ui.value = Math.round((ui.value + 0.25) * 4) % 5 / 4;
    }
    if (!Sim.running) Sim.evaluate();
    Sim.changed = true;
    App.emit('sim');
  };

  // Test isolé d'une définition (éditeur de composants)
  Sim.testLogic = function (def, inp, props, ui, t, state) {
    delete compiled[def.id];
    const fn = Sim.compile(def);
    const st = Object.assign({}, state);
    const out = fn(inp, Object.assign({}, def.props, props), st, Object.assign({ on: false, pressed: false, value: 0.5 }, ui), t || 0);
    return { out: out || {}, state: st };
  };

  App.on('change', () => {
    Sim.dirty = true;
    if (!Sim.running) Sim.evaluate();
  });
})();
