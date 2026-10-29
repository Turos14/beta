/*
 * Vue SVG d'un schéma. Deux modes :
 *  - 'edit' : déplacer / câbler / sélectionner
 *  - 'sim'  : afficher les tensions et interagir avec les composants
 */
(function () {
  const NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  App.hexA = function (hex, a) {
    let h = String(hex || '#33ff66').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16);
    if (isNaN(n)) return 'rgba(51,255,102,' + a + ')';
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  };

  const fmtV = v => (v === null || v === undefined ? 'Z (flottant)' : (+v).toFixed(2) + ' V');

  // Dessine un composant (utilisé aussi pour l'aperçu de l'éditeur de composants)
  App.drawComponent = function (parent, comp, def, opts) {
    opts = opts || {};
    const g = App.defGeom(def);
    const props = App.compProps(comp, def);
    const st = opts.state || {};
    const ui = opts.ui || { on: false, pressed: false, value: 0.5 };
    const cx = comp.x + g.w / 2, cy = comp.y + g.h / 2;
    const rotated = ((comp.rot || 0) / 90) % 2 === 1;
    const halfH = rotated ? g.w / 2 : g.h / 2;
    const halfW = rotated ? g.h / 2 : g.w / 2;
    const color = def.id === 'led' ? props.couleur || def.color : def.color;

    const root = el('g', { class: 'comp' + (opts.selected ? ' selected' : '') + (def.interactive !== 'none' && opts.mode === 'sim' ? ' interactive' : ''), 'data-comp': comp.id }, parent);
    const body = el('g', { transform: 'translate(' + comp.x + ',' + comp.y + ') rotate(' + (comp.rot || 0) + ' ' + g.w / 2 + ' ' + g.h / 2 + ')' }, root);
    el('rect', { class: 'comp-body', x: 0, y: 0, width: g.w, height: g.h, rx: def.id === 'connector' ? 10 : 4, fill: App.hexA(def.color, 0.18), stroke: def.color }, body);

    // Contenu central selon le type d'affichage / d'interaction
    const center = (txt, cls) => { const t = el('text', { x: cx, y: cy + 3, 'text-anchor': 'middle', class: cls || 'comp-sub' }, root); t.textContent = txt; return t; };
    if (def.display === 'led') {
      const light = st.light || 0;
      if (light > 0) el('circle', { cx, cy, r: 14, fill: App.hexA(color, 0.25 * light) }, root);
      el('circle', { cx, cy, r: 7, fill: light > 0 ? color : App.hexA(color, 0.15), stroke: color, 'stroke-width': 1 }, root);
    } else if (def.display === 'value') {
      center(st.text != null ? String(st.text) : '--', 'comp-label');
    } else if (def.display === 'motor') {
      const a = (opts.angle || 0);
      el('circle', { cx, cy, r: 9, fill: 'none', stroke: def.color }, root);
      el('line', { x1: cx - 8 * Math.cos(a), y1: cy - 8 * Math.sin(a), x2: cx + 8 * Math.cos(a), y2: cy + 8 * Math.sin(a), stroke: '#33ff66', 'stroke-width': 2 }, root);
    } else if (def.interactive === 'switch') {
      center(ui.on ? 'ON' : 'OFF', 'comp-label');
    } else if (def.interactive === 'button') {
      el('rect', { x: cx - 8, y: cy - 8, width: 16, height: 16, rx: 3, fill: ui.pressed ? '#33ff66' : 'none', stroke: def.color }, root);
    } else if (def.interactive === 'slider') {
      const w = halfW * 2 - 16;
      el('line', { x1: cx - w / 2, y1: cy, x2: cx + w / 2, y2: cy, stroke: def.color, 'stroke-width': 2 }, root);
      el('circle', { cx: cx - w / 2 + w * ui.value, cy, r: 5, fill: '#33ff66' }, root);
    } else if (def.id === 'connector') {
      center(String(props.canal), 'comp-label');
    } else {
      center(def.name.length > 10 ? def.name.slice(0, 9) + '…' : def.name);
    }

    // Étiquette au-dessus
    const label = def.id === 'connector' ? '⇄' : (comp.label || def.name);
    const lt = el('text', { x: cx, y: cy - halfH - 5, 'text-anchor': 'middle', class: 'comp-label' }, root);
    lt.textContent = label;
    if (def.display === 'motor' && st.text) {
      const mt = el('text', { x: cx, y: cy + halfH + 11, 'text-anchor': 'middle', class: 'net-val' }, root);
      mt.textContent = st.text;
    }

    // Pôles
    def.pins.forEach(p => {
      const w = App.pinWorld(comp, p.name);
      if (!w) return;
      if (def.id !== 'connector' && !opts.noPinNames) {
        const tx = w.x - w.dir[0] * 6, ty = w.y - w.dir[1] * 7 + (w.dir[1] === 0 ? 3 : (w.dir[1] < 0 ? 3 : 0));
        const anchor = w.dir[0] < 0 ? 'start' : w.dir[0] > 0 ? 'end' : 'middle';
        const t = el('text', { x: tx, y: ty, 'text-anchor': anchor, class: 'pin-name' }, root);
        t.textContent = p.name;
      }
      const isPending = opts.pending && opts.pending.c === comp.id && opts.pending.p === p.name;
      const dot = el('circle', { cx: w.x, cy: w.y, r: 3.5, class: 'pin-dot' + (isPending ? ' pending' : ''), 'data-pin': comp.id + '|' + p.name }, root);
      const title = el('title', {}, dot);
      title.textContent = p.name + ' (' + p.type + ')' + (opts.pinValue ? ' = ' + fmtV(opts.pinValue(p.name)) : '');
    });
    return root;
  };

  // ---- Vue ----
  function SchematicView(svg, mode) {
    this.svg = svg;
    this.mode = mode;
    this.views = {};      // boardId -> { x, y, scale }
    this.pending = null;  // pôle de départ d'un fil
    this.ghost = null;
    this.motorAngle = {};
    this.bind();
  }
  App.SchematicView = SchematicView;

  SchematicView.prototype.view = function () {
    const b = App.board();
    if (!this.views[b.id]) this.views[b.id] = { x: 0, y: 0, scale: 1.5, fitted: false };
    return this.views[b.id];
  };

  SchematicView.prototype.applyView = function () {
    const v = this.view();
    const r = this.svg.getBoundingClientRect();
    this.svg.setAttribute('viewBox', v.x + ' ' + v.y + ' ' + (r.width / v.scale || 1) + ' ' + (r.height / v.scale || 1));
  };

  SchematicView.prototype.toWorld = function (clientX, clientY) {
    const v = this.view(), r = this.svg.getBoundingClientRect();
    return { x: v.x + (clientX - r.left) / v.scale, y: v.y + (clientY - r.top) / v.scale };
  };

  SchematicView.prototype.fit = function () {
    const b = App.board();
    const r = this.svg.getBoundingClientRect();
    if (!r.width) return;
    const bb = App.boardBounds(b);
    const pad = 40;
    const scale = Math.max(0.3, Math.min(3, Math.min(r.width / (bb.w + pad * 2), r.height / (bb.h + pad * 2))));
    this.views[b.id] = {
      scale, fitted: true,
      x: bb.x + bb.w / 2 - r.width / scale / 2,
      y: bb.y + bb.h / 2 - r.height / scale / 2
    };
    this.applyView();
  };

  SchematicView.prototype.render = function () {
    const svg = this.svg, b = App.board(), Sim = App.Sim;
    const sim = this.mode === 'sim';
    if (!this.view().fitted) this.fit();
    svg.innerHTML = '';
    const defs = el('defs', {}, svg);
    const pat = el('pattern', { id: 'grid-' + this.mode, width: 10, height: 10, patternUnits: 'userSpaceOnUse' }, defs);
    el('circle', { cx: 0.5, cy: 0.5, r: 0.8, class: 'grid-dot' }, pat);
    el('rect', { x: -5000, y: -5000, width: 10000, height: 10000, fill: 'url(#grid-' + this.mode + ')', 'data-bg': 1 }, svg);

    const sel = App.state.selection;
    const wires = el('g', {}, svg);
    b.wires.forEach(w => {
      const pts = App.wirePath(b, w);
      if (!pts) return;
      const d = 'M' + pts.map(p => p.join(',')).join(' L');
      let cls = 'wire';
      let title = '';
      if (sim) {
        const v = Sim.valueAt(b.id, w.a.c, w.a.p);
        cls += v === null ? ' float' : v > 0.5 ? ' on' : ' off';
        title = fmtV(v) + (Sim.conflicts[Sim.netOf(b.id, w.a.c, w.a.p)] ? ' — conflit' : '');
      } else if (sel && sel.kind === 'wire' && sel.id === w.id) cls += ' selected';
      el('path', { d, class: cls }, wires);
      const hit = el('path', { d, class: 'wire-hit', 'data-wire': w.id }, wires);
      if (title) el('title', {}, hit).textContent = title;
    });

    const comps = el('g', {}, svg);
    b.components.forEach(c => {
      const def = App.getDef(c.type);
      if (!def) {
        const t = el('text', { x: c.x, y: c.y, fill: '#ff5555', 'data-comp': c.id }, comps);
        t.textContent = '? ' + c.type;
        return;
      }
      const key = Sim.compKey(b.id, c.id);
      const st = Sim.states[key] || {};
      if (def.display === 'motor' && sim && Sim.running) {
        this.motorAngle[key] = (this.motorAngle[key] || 0) + (st.speed || 0) * 0.3;
      }
      App.drawComponent(comps, c, def, {
        mode: this.mode,
        selected: !sim && sel && sel.kind === 'comp' && sel.id === c.id,
        pending: this.pending,
        state: sim || Sim.running ? st : {},
        ui: Sim.ui[key],
        angle: this.motorAngle[key],
        pinValue: sim ? (p) => Sim.valueAt(b.id, c.id, p) : null
      });
      if (sim && Sim.errors[key]) {
        const t = el('text', { x: c.x, y: c.y - 16, class: 'net-val', fill: '#ff5555' }, comps);
        t.textContent = '⚠ ' + Sim.errors[key];
      }
    });

    this.ghostLayer = el('g', {}, svg);
    if (this.ghost) this.drawGhost(this.ghost);
    this.applyView();
  };

  SchematicView.prototype.drawGhost = function (pt) {
    this.ghost = pt;
    if (!this.ghostLayer || !this.pending) return;
    this.ghostLayer.innerHTML = '';
    const b = App.board(), c = App.findComp(b, this.pending.c);
    const A = c && App.pinWorld(c, this.pending.p);
    if (!A) return;
    const pts = App.routePoints(A, { x: pt.x, y: pt.y });
    el('path', { d: 'M' + pts.map(p => p.join(',')).join(' L'), class: 'wire ghost' }, this.ghostLayer);
  };

  // Valeur 0..1 d'un curseur selon la position du pointeur
  function sliderValue(comp, def, pt) {
    // Le curseur est toujours dessiné horizontalement, centré sur le composant
    const g = App.defGeom(def);
    const rotated = ((comp.rot || 0) / 90) % 2 === 1;
    const w = (rotated ? g.h : g.w) - 16;
    return (pt.x - (comp.x + g.w / 2) + w / 2) / w;
  }

  SchematicView.prototype.bind = function () {
    const svg = this.svg, self = this;
    const pointers = new Map();
    let act = null;

    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      self.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });

    svg.addEventListener('pointerdown', (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      svg.setPointerCapture(e.pointerId);
      if (pointers.size === 2) {
        const [p1, p2] = [...pointers.values()];
        act = { kind: 'pinch', dist: Math.hypot(p1.x - p2.x, p1.y - p2.y) };
        return;
      }
      const b = App.board();
      const pt = self.toWorld(e.clientX, e.clientY);
      const pinEl = e.target.closest('[data-pin]');
      const wireEl = e.target.closest('[data-wire]');
      const compEl = e.target.closest('[data-comp]');

      if (self.mode === 'edit' && pinEl) {
        const [c, p] = pinEl.getAttribute('data-pin').split('|');
        if (!self.pending) {
          self.pending = { c, p };
          self.render();
        } else {
          App.addWire(b, self.pending, { c, p });
          self.pending = null; self.ghost = null;
          self.render();
        }
        act = null;
        return;
      }
      if (self.mode === 'edit' && self.pending && !pinEl) {
        self.pending = null; self.ghost = null; self.render();
      }
      if (compEl) {
        const comp = App.findComp(b, compEl.getAttribute('data-comp'));
        if (!comp) return;
        if (self.mode === 'edit') {
          App.state.selection = { kind: 'comp', id: comp.id };
          App.emit('select');
          act = { kind: 'drag', comp, ox: comp.x, oy: comp.y, sx: pt.x, sy: pt.y, moved: false };
          self.render();
        } else {
          const def = App.getDef(comp.type);
          if (!def) return;
          if (def.interactive === 'switch') App.Sim.interact(b.id, comp.id, 'click');
          else if (def.interactive === 'button') { App.Sim.interact(b.id, comp.id, 'down'); act = { kind: 'button', comp }; }
          else if (def.interactive === 'slider') {
            App.Sim.interact(b.id, comp.id, 'set', sliderValue(comp, def, pt));
            act = { kind: 'slider', comp, def };
          }
          if (!act) act = { kind: 'none' };
        }
        return;
      }
      if (self.mode === 'edit' && wireEl) {
        App.state.selection = { kind: 'wire', id: wireEl.getAttribute('data-wire') };
        App.emit('select');
        self.render();
        return;
      }
      const v = self.view();
      act = { kind: 'pan', cx: e.clientX, cy: e.clientY, vx: v.x, vy: v.y, moved: false };
    });

    svg.addEventListener('pointermove', (e) => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (self.pending && self.mode === 'edit') self.drawGhost(self.toWorld(e.clientX, e.clientY));
      if (!act) return;
      if (act.kind === 'pinch' && pointers.size === 2) {
        const [p1, p2] = [...pointers.values()];
        const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        self.zoomAt((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, d / act.dist);
        act.dist = d;
      } else if (act.kind === 'drag') {
        const pt = self.toWorld(e.clientX, e.clientY);
        const nx = App.snap(act.ox + pt.x - act.sx), ny = App.snap(act.oy + pt.y - act.sy);
        if (nx !== act.comp.x || ny !== act.comp.y) {
          act.comp.x = nx; act.comp.y = ny; act.moved = true;
          self.render();
        }
      } else if (act.kind === 'pan') {
        const v = self.view();
        v.x = act.vx - (e.clientX - act.cx) / v.scale;
        v.y = act.vy - (e.clientY - act.cy) / v.scale;
        if (Math.abs(e.clientX - act.cx) + Math.abs(e.clientY - act.cy) > 3) act.moved = true;
        self.applyView();
      } else if (act.kind === 'slider') {
        App.Sim.interact(App.board().id, act.comp.id, 'set', sliderValue(act.comp, act.def, self.toWorld(e.clientX, e.clientY)));
      }
    });

    const end = (e) => {
      pointers.delete(e.pointerId);
      if (!act) return;
      if (act.kind === 'drag' && act.moved) App.changed('move');
      if (act.kind === 'button') App.Sim.interact(App.board().id, act.comp.id, 'up');
      if (act.kind === 'pan' && !act.moved && self.mode === 'edit' && App.state.selection) {
        App.state.selection = null;
        App.emit('select');
        self.render();
      }
      act = null;
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);

    // Dépôt depuis la palette (glisser-déposer)
    svg.addEventListener('dragover', (e) => { if (self.mode === 'edit') e.preventDefault(); });
    svg.addEventListener('drop', (e) => {
      if (self.mode !== 'edit') return;
      e.preventDefault();
      const type = e.dataTransfer.getData('text/plain');
      self.addAt(type, self.toWorld(e.clientX, e.clientY));
    });
  };

  SchematicView.prototype.addAt = function (type, pt) {
    const def = App.getDef(type);
    if (!def) return;
    if (!pt) {
      const r = this.svg.getBoundingClientRect();
      pt = this.toWorld(r.left + r.width / 2, r.top + r.height / 2);
    }
    const g = App.defGeom(def);
    const c = App.addComponent(App.board(), type, pt.x - g.w / 2, pt.y - g.h / 2);
    App.state.selection = { kind: 'comp', id: c.id };
    App.emit('select');
  };

  SchematicView.prototype.zoomAt = function (clientX, clientY, factor) {
    const v = this.view();
    const before = this.toWorld(clientX, clientY);
    v.scale = Math.max(0.2, Math.min(6, v.scale * factor));
    const after = this.toWorld(clientX, clientY);
    v.x += before.x - after.x;
    v.y += before.y - after.y;
    this.applyView();
  };

  SchematicView.prototype.cancelWire = function () {
    if (!this.pending) return false;
    this.pending = null; this.ghost = null; this.render();
    return true;
  };
})();
