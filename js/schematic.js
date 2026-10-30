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
    this.pending = null;  // départ du fil en cours : pôle { c, p } ou point { x, y }
    this.via = [];        // points de passage du fil en cours
    this.ghost = null;
    this.motorAngle = {};
    this.animated = false; // un moteur tourne sur la plaque affichée : redessiner à chaque image
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
    const freeEnds = {};   // "x,y" -> nombre d'extrémités libres (jonctions)
    let selWire = null;
    b.wires.forEach(w => {
      const pts = App.wirePath(b, w);
      if (!pts) return;
      const d = 'M' + pts.map(p => p.join(',')).join(' L');
      let cls = 'wire' + (w.color ? ' colored' : '');
      let title = '';
      if (sim) {
        const v = Sim.wireValue(b.id, w.id);
        cls += v === null ? ' float' : v > 0.5 ? ' on' : ' off';
        title = fmtV(v) + (Sim.wireConflict(b.id, w.id) ? ' — conflit' : '');
      } else if (sel && sel.kind === 'wire' && sel.id === w.id) { cls += ' selected'; selWire = w; }
      const attrs = { d, class: cls };
      if (w.color) attrs.style = 'stroke:' + w.color;
      el('path', attrs, wires);
      const hit = el('path', { d, class: 'wire-hit', 'data-wire': w.id }, wires);
      if (title) el('title', {}, hit).textContent = title;
      ['a', 'b'].forEach(k => {
        if (App.isPinEnd(w[k])) return;
        const key = w[k].x + ',' + w[k].y;
        freeEnds[key] = (freeEnds[key] || 0) + 1;
      });
    });
    // Extrémités libres (carré) et jonctions (point plein)
    Object.keys(freeEnds).forEach(key => {
      const [x, y] = key.split(',').map(Number);
      if (freeEnds[key] > 1) el('circle', { cx: x, cy: y, r: 3.5, class: 'junction' }, wires);
      const m = el('rect', { x: x - 3, y: y - 3, width: 6, height: 6, class: 'wire-end', 'data-pt': key }, wires);
      el('title', {}, m).textContent = sim ? '' : 'extrémité libre : cliquer pour partir d\'ici';
    });

    const comps = el('g', {}, svg);
    this.animated = false;
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
        if (st.speed) this.animated = true;
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

    // Poignées du fil sélectionné : points de passage (ronds) et extrémités libres (carrés)
    if (selWire) {
      const handles = el('g', {}, svg);
      (selWire.pts || []).forEach((p, i) => {
        const h = el('circle', { cx: p[0], cy: p[1], r: 4.5, class: 'via-handle', 'data-via': selWire.id + '|' + i }, handles);
        el('title', {}, h).textContent = 'point de passage : glisser pour déplacer, double-clic pour retirer';
      });
      ['a', 'b'].forEach(k => {
        const e = selWire[k];
        if (App.isPinEnd(e)) return;
        const h = el('rect', { x: e.x - 5, y: e.y - 5, width: 10, height: 10, class: 'end-handle', 'data-end': selWire.id + '|' + k }, handles);
        el('title', {}, h).textContent = 'extrémité libre : glisser (sur un pôle pour la brancher)';
      });
    }

    this.ghostLayer = el('g', {}, svg);
    if (this.ghost) this.drawGhost(this.ghost);
    this.applyView();
  };

  SchematicView.prototype.drawGhost = function (pt) {
    this.ghost = pt;
    if (!this.ghostLayer || !this.pending) return;
    this.ghostLayer.innerHTML = '';
    const A = App.endPos(App.board(), this.pending);
    if (!A) return;
    const pts = App.routePoints(A, { x: App.snap(pt.x), y: App.snap(pt.y), dir: null }, this.via);
    const attrs = { d: 'M' + pts.map(p => p.join(',')).join(' L'), class: 'wire ghost' };
    if (App.state.wireColor) attrs.style = 'stroke:' + App.state.wireColor;
    el('path', attrs, this.ghostLayer);
    this.via.forEach(p => el('circle', { cx: p[0], cy: p[1], r: 3, class: 'via-ghost' }, this.ghostLayer));
  };

  // ---- Câblage ----
  SchematicView.prototype.startWire = function (end) {
    this.pending = end;
    this.via = [];
    this.render();
  };

  // Termine le fil en cours sur un pôle ou un point libre
  SchematicView.prototype.finishWire = function (end) {
    if (!this.pending) return null;
    const extra = { pts: this.via, color: App.state.wireColor };
    const w = App.addWire(App.board(), this.pending, end, extra);
    this.pending = null; this.via = []; this.ghost = null;
    if (w) { App.state.selection = { kind: 'wire', id: w.id }; App.emit('select'); }
    this.render();
    return w;
  };

  // Termine le fil sur son dernier point de passage, laissé en extrémité libre
  SchematicView.prototype.endWireHere = function () {
    if (!this.pending) return false;
    if (!this.via.length) { App.toast('cliquer sur le schéma pour poser au moins un point, puis terminer', true); return false; }
    const last = this.via.pop();
    return !!this.finishWire({ x: last[0], y: last[1] });
  };

  SchematicView.prototype.addVia = function (pt) {
    const p = [App.snap(pt.x), App.snap(pt.y)];
    const last = this.via[this.via.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) this.via.push(p);
    this.drawGhost(pt);
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
    let lastDown = null;   // pour détecter le double-clic (le SVG est re-dessiné entre deux clics,
                           // le navigateur n'émet donc pas d'événement dblclick fiable)

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
      const now = performance.now();
      const isDouble = lastDown && now - lastDown.t < 400 && Math.hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) < 6;
      lastDown = isDouble ? null : { t: now, x: e.clientX, y: e.clientY };
      if (isDouble && self.mode === 'edit' && self.handleDouble(e)) { act = null; return; }

      const b = App.board();
      const pt = self.toWorld(e.clientX, e.clientY);
      const pinEl = e.target.closest('[data-pin]');
      const wireEl = e.target.closest('[data-wire]');
      const compEl = e.target.closest('[data-comp]');
      const viaEl = e.target.closest('[data-via]');
      const endEl = e.target.closest('[data-end]');
      const ptEl = e.target.closest('[data-pt]');
      const edit = self.mode === 'edit';

      // Poignées du fil sélectionné
      if (edit && !self.pending && (viaEl || endEl)) {
        const [wid, key] = (viaEl || endEl).getAttribute(viaEl ? 'data-via' : 'data-end').split('|');
        const wire = b.wires.find(w => w.id === wid);
        if (wire) act = { kind: 'handle', wire, via: viaEl ? +key : null, end: endEl ? key : null, moved: false };
        return;
      }
      // Pôle ou extrémité libre : début ou fin de fil
      if (edit && (pinEl || ptEl || (self.pending && endEl))) {
        let end;
        if (pinEl) {
          const [c, p] = pinEl.getAttribute('data-pin').split('|');
          end = { c, p };
        } else if (ptEl) {
          const [x, y] = ptEl.getAttribute('data-pt').split(',').map(Number);
          end = { x, y };
        } else {
          const [wid, k] = endEl.getAttribute('data-end').split('|');
          const w = b.wires.find(x => x.id === wid);
          end = { x: w[k].x, y: w[k].y };
        }
        if (!self.pending) self.startWire(end); else self.finishWire(end);
        act = null;
        return;
      }
      // Fil en cours : un clic pose un point de passage, un glisser déplace la vue
      if (edit && self.pending) {
        const v = self.view();
        act = { kind: 'pan', cx: e.clientX, cy: e.clientY, vx: v.x, vy: v.y, moved: false, via: pt };
        return;
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
      } else if (act.kind === 'handle') {
        const pt = self.toWorld(e.clientX, e.clientY);
        const p = [App.snap(pt.x), App.snap(pt.y)];
        if (act.via !== null) act.wire.pts[act.via] = p;
        else act.wire[act.end] = { x: p[0], y: p[1] };
        act.moved = true;
        self.render();
      } else if (act.kind === 'slider') {
        App.Sim.interact(App.board().id, act.comp.id, 'set', sliderValue(act.comp, act.def, self.toWorld(e.clientX, e.clientY)));
      }
    });

    const end = (e) => {
      pointers.delete(e.pointerId);
      if (!act) return;
      if (act.kind === 'drag' && act.moved) App.changed('move');
      if (act.kind === 'handle' && act.moved) {
        // Une extrémité libre lâchée sur un pôle s'y branche
        if (act.end) {
          const e2 = act.wire[act.end];
          const pin = App.pinNear(App.board(), e2, 8);
          if (pin) act.wire[act.end] = pin;
        }
        App.changed('wire');
      }
      if (act.kind === 'pan' && act.via && !act.moved && self.pending) self.addVia(act.via);
      if (act.kind === 'button') App.Sim.interact(App.board().id, act.comp.id, 'up');
      if (act.kind === 'pan' && !act.moved && self.mode === 'edit' && !self.pending && App.state.selection) {
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

  // Double-clic : terminer un fil sur un point libre, ajouter / retirer un point de passage.
  // Retourne true si le geste a été utilisé.
  SchematicView.prototype.handleDouble = function (e) {
    const b = App.board();
    const pt = this.toWorld(e.clientX, e.clientY);
    const p = [App.snap(pt.x), App.snap(pt.y)];
    const target = document.elementFromPoint(e.clientX, e.clientY) || e.target;
    if (this.pending) {
      if (target.closest('[data-pin]') || target.closest('[data-pt]')) return false;
      while (this.via.length && this.via[this.via.length - 1][0] === p[0] && this.via[this.via.length - 1][1] === p[1]) this.via.pop();
      this.finishWire({ x: p[0], y: p[1] });
      return true;
    }
    const viaEl = target.closest('[data-via]');
    if (viaEl) {
      const [wid, i] = viaEl.getAttribute('data-via').split('|');
      const w = b.wires.find(x => x.id === wid);
      w.pts.splice(+i, 1);
      if (!w.pts.length) delete w.pts;
      App.changed('wire');
      return true;
    }
    const wireEl = target.closest('[data-wire]');
    if (wireEl) {
      const w = b.wires.find(x => x.id === wireEl.getAttribute('data-wire'));
      App.addViaPoint(b, w, p);
      App.state.selection = { kind: 'wire', id: w.id };
      App.emit('select');
      return true;
    }
    return false;
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
    this.pending = null; this.via = []; this.ghost = null; this.render();
    return true;
  };

  // Insère un point de passage sur un fil existant, à l'endroit le plus logique
  App.addViaPoint = function (board, wire, p) {
    wire.pts = wire.pts || [];
    wire.pts.splice(App.bestViaIndex(board, wire, p), 0, p);
    App.changed('wire');
  };
})();
