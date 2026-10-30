/*
 * Vue 3D : chaque schéma devient une plaque (PCB). Les connecteurs de même canal
 * sont reliés par des câbles entre plaques. Quand la simulation tourne, LED, moteurs,
 * pistes et afficheurs reflètent l'état du circuit ; on peut cliquer sur les
 * composants interactifs.
 */
(function () {
  const S = 1 / 20;           // 20 px du schéma = 1 unité 3D
  const BOARD_T = 0.12;       // épaisseur de plaque
  const STACK_GAP = 3.2;
  const V3 = {};
  App.View3D = V3;

  let renderer, scene, camera, controls, root, raycaster, wrap;
  let dyn = null;             // objets animés
  let cables = null;          // groupe des câbles entre plaques (masquable)
  let localCables = null;     // câbles du canal isolé entre connecteurs d'une même plaque
  let connPosOf = null;       // position 3D d'un connecteur { board, comp } (scène courante)
  let fogDist = 30;           // distance de référence du brouillard (taille de la scène)
  let dirty = true, visible = false, raf = 0, needsFrame = true;
  let pressed = null;

  function canvasTexture(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }

  function makeLabel(text, color, height) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(height * 4, height, 1);
    sp.setText = function (t) {
      if (sp._text === t) return;
      sp._text = t;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 256, 64);
      ctx.font = 'bold 34px Consolas, "Droid Sans Mono", Menlo, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const w = Math.min(250, ctx.measureText(t).width + 16);
      ctx.fillRect(128 - w / 2, 10, w, 44);
      ctx.fillStyle = color || '#33ff66';
      ctx.fillText(t, 128, 33, 240);
      tex.needsUpdate = true;
    };
    sp.setText(text);
    return sp;
  }

  // Étiquette fixe partagée : un même texte (nom de signal répété sur de nombreux
  // connecteurs) n'utilise qu'une seule texture
  function cachedLabel(cache, text, color, height) {
    const key = text + '|' + color;
    if (!cache.has(key)) cache.set(key, makeLabel(text, color, height).material);
    const sp = new THREE.Sprite(cache.get(key));
    sp.scale.set(height * 4, height, 1);
    return sp;
  }

  const mat = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0.1 }, extra));
  // Ressources partagées, créées seulement si Three.js a pu être chargé
  const HAS_THREE = typeof THREE !== 'undefined';
  const GOLD = HAS_THREE ? mat('#c9a43a', { metalness: 0.8, roughness: 0.3 }) : null;
  const PAD_GEO = HAS_THREE ? new THREE.CylinderGeometry(0.07, 0.07, 0.03, 12) : null;   // pastille partagée

  V3.init = function () {
    wrap = document.getElementById('view3dWrap');
    if (typeof THREE === 'undefined') {
      wrap.innerHTML = '<p class="muted" style="padding:16px">Three.js n\'a pas pu être chargé (connexion internet requise pour la vue 3D).</p>';
      return false;
    }
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000);
    wrap.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000000, 40, 90);
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
    camera.position.set(10, 12, 16);
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.addEventListener('change', () => { needsFrame = true; });
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(8, 20, 10);
    scene.add(sun);
    const grid = new THREE.GridHelper(80, 80, 0x1f5a2a, 0x0c240f);
    grid.position.y = -1.5;
    scene.add(grid);
    raycaster = new THREE.Raycaster();

    window.addEventListener('resize', V3.resize);
    renderer.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    document.getElementById('layout3d').addEventListener('change', () => { dirty = true; V3.build(true); });
    V3.applyFog();
    return true;
  };

  V3.resize = function () {
    if (!renderer || !wrap) return;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    needsFrame = true;
  };

  // ---- Construction de la scène ----
  function buildShape(def, g, props) {
    const grp = new THREE.Group();
    const w = g.w * S, d = g.h * S;
    const color = def.color;
    const parts = {};
    switch (def.shape3d) {
      case 'box': {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 0.3, d * 0.85), mat(color));
        m.position.y = 0.15; grp.add(m); break;
      }
      case 'cylinder': {
        const r = Math.min(d * 0.4, 0.6);
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w * 0.8, 24), mat(color));
        m.rotation.z = Math.PI / 2; m.position.y = r; grp.add(m);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.4, r * 0.4, 0.08, 16), GOLD);
        cap.rotation.z = Math.PI / 2; cap.position.set(w * 0.42, r, 0); grp.add(cap);
        break;
      }
      case 'resistor': {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, w * 0.5, 16), mat('#d8c39a'));
        body.rotation.z = Math.PI / 2; body.position.y = 0.2; grp.add(body);
        ['#8b4513', '#000000', '#c0392b', '#c9a43a'].forEach((c, i) => {
          const band = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 16), mat(c));
          band.rotation.z = Math.PI / 2; band.position.set(-w * 0.18 + i * w * 0.11, 0.2, 0); grp.add(band);
        });
        const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, w, 6), GOLD);
        lead.rotation.z = Math.PI / 2; lead.position.y = 0.2; grp.add(lead);
        break;
      }
      case 'led': {
        const c = props.couleur || color;
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.08, 20), mat(c, { transparent: true, opacity: 0.8 }));
        base.position.y = 0.04; grp.add(base);
        const m = mat(c, { transparent: true, opacity: 0.75, emissive: new THREE.Color(c), emissiveIntensity: 0 });
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 20), m);
        tube.position.y = 0.23; grp.add(tube);
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m);
        dome.position.y = 0.38; grp.add(dome);
        const glow = new THREE.PointLight(c, 0, 3);
        glow.position.y = 0.6; grp.add(glow);
        parts.led = { mat: m, glow };
        break;
      }
      case 'switch': case 'button': case 'pot': {
        const base = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.25, d * 0.7), mat('#222'));
        base.position.y = 0.125; grp.add(base);
        if (def.shape3d === 'switch') {
          const pivot = new THREE.Group(); pivot.position.y = 0.25;
          const lever = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.12), mat(color));
          lever.position.y = 0.25; pivot.add(lever); grp.add(pivot);
          parts.lever = pivot;
        } else if (def.shape3d === 'button') {
          const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.18, 20), mat(color));
          cap.position.y = 0.34; grp.add(cap);
          parts.cap = cap;
        } else {
          const knob = new THREE.Group(); knob.position.y = 0.25;
          const k = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.25, 24), mat(color));
          k.position.y = 0.125; knob.add(k);
          const mark = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.22), mat('#33ff66', { emissive: new THREE.Color('#33ff66'), emissiveIntensity: 0.6 }));
          mark.position.set(0, 0.26, -0.11); knob.add(mark);
          grp.add(knob);
          parts.knob = knob;
        }
        break;
      }
      case 'motor': {
        const r = Math.min(w, d) * 0.4;
        const can = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.55, 24), mat(color, { metalness: 0.6, roughness: 0.35 }));
        can.position.y = 0.275; grp.add(can);
        const rotor = new THREE.Group(); rotor.position.y = 0.7;
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8), GOLD);
        shaft.position.y = -0.1; rotor.add(shaft);
        const blade = new THREE.Mesh(new THREE.BoxGeometry(r * 2.4, 0.03, 0.14), mat('#33ff66'));
        rotor.add(blade); grp.add(rotor);
        parts.rotor = rotor;
        break;
      }
      case 'probe': {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.3, d * 0.8), mat(color));
        m.position.y = 0.15; grp.add(m);
        break;
      }
      case 'connector': {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.35, d * 0.7), mat('#111', { emissive: new THREE.Color(color), emissiveIntensity: 0.25 }));
        m.position.y = 0.175; grp.add(m);
        break;
      }
      default: { // chip
        const m = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.22, d * 0.8), mat('#151515', { roughness: 0.4 }));
        m.position.y = 0.11; grp.add(m);
        const top = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.01, d * 0.12), mat(color, { emissive: new THREE.Color(color), emissiveIntensity: 0.2 }));
        top.position.set(0, 0.225, -d * 0.25); grp.add(top);
        const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.01, 12), mat('#555'));
        dot.position.set(-w * 0.3, 0.225, d * 0.25); grp.add(dot);
        if (def.display === 'led') {
          const lm = mat('#33ff66', { emissive: new THREE.Color('#33ff66'), emissiveIntensity: 0 });
          const l = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), lm);
          l.position.set(w * 0.3, 0.26, d * 0.25); grp.add(l);
          parts.led = { mat: lm };
        }
      }
    }
    return { grp, parts };
  }

  V3.build = function (refit) {
    if (!scene) return;
    if (root) {
      scene.remove(root);
      root.traverse(o => {
        if (o.geometry && o.geometry !== PAD_GEO) o.geometry.dispose();
        if (o.material && o.material !== GOLD) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
      });
    }
    root = new THREE.Group();
    scene.add(root);
    dyn = { leds: [], levers: [], caps: [], knobs: [], rotors: [], texts: [], traces: [], cables: [], hits: [] };
    const labels = new Map();

    const layout = document.getElementById('layout3d').value;
    const boards = App.project.schematics;
    const placed = {};   // boardId -> { origin: Vector3, cx, cy }
    let xCursor = 0;
    const sizes = boards.map(b => App.boardBounds(b));
    const totalW = sizes.reduce((a, s) => a + s.w * S + 2, 0) - 2;

    boards.forEach((b, i) => {
      const bb = sizes[i];
      const W = bb.w * S + 1.5, D = bb.h * S + 1.5;
      let origin;
      if (layout === 'row') {
        origin = new THREE.Vector3(-totalW / 2 + xCursor + bb.w * S / 2, 0, 0);
        xCursor += bb.w * S + 2;
      } else {
        origin = new THREE.Vector3(0, i * STACK_GAP, 0);
      }
      const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
      placed[b.id] = { origin, cx, cy, W, D };
      const toLocal = (px, py) => new THREE.Vector3((px - cx) * S, BOARD_T / 2, (py - cy) * S);

      const group = new THREE.Group();
      group.position.copy(origin);
      root.add(group);

      // Plaque avec sérigraphie
      const tex = canvasTexture(1024, Math.max(64, Math.round(1024 * D / W)), (ctx, w, h) => {
        ctx.fillStyle = '#0b2a12'; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(51,255,102,0.08)'; ctx.lineWidth = 1;
        const step = w / (W * 2);
        for (let x = 0; x < w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
        for (let y = 0; y < h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(51,255,102,0.5)'; ctx.lineWidth = 4; ctx.strokeRect(8, 8, w - 16, h - 16);
        ctx.fillStyle = 'rgba(220,255,220,0.85)';
        ctx.font = 'bold ' + Math.round(step * 0.9) + 'px Consolas, monospace';
        ctx.fillText(b.name, 20, h - 20);
      });
      const plateMats = [mat('#0e3b18'), mat('#0e3b18'), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), mat('#0e3b18'), mat('#0e3b18'), mat('#0e3b18')];
      const plate = new THREE.Mesh(new THREE.BoxGeometry(W, BOARD_T, D), plateMats);
      group.add(plate);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(plate.geometry), new THREE.LineBasicMaterial({ color: 0x33ff66, transparent: true, opacity: 0.5 }));
      group.add(edges);

      // Entretoises entre plaques empilées
      if (layout === 'stack' && i < boards.length - 1) {
        const nb = sizes[i + 1];
        const sw = Math.min(W, nb.w * S + 1.5) / 2 - 0.25, sd = Math.min(D, nb.h * S + 1.5) / 2 - 0.25;
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, STACK_GAP, 10), mat('#9a9a9a', { metalness: 0.7 }));
          post.position.set(sx * sw, STACK_GAP / 2, sz * sd);
          group.add(post);
        });
      }

      // Pistes
      b.wires.forEach(w => {
        const pts = App.wirePath(b, w);
        if (!pts) return;
        const color = w.color || '#2fbf55';
        const tm = mat(color, { metalness: 0.5, roughness: 0.4, emissive: new THREE.Color(w.color || '#33ff66'), emissiveIntensity: 0 });
        for (let k = 0; k < pts.length - 1; k++) {
          const a = toLocal(pts[k][0], pts[k][1]), c = toLocal(pts[k + 1][0], pts[k + 1][1]);
          const len = a.distanceTo(c);
          if (len < 1e-4) continue;
          const seg = new THREE.Mesh(new THREE.BoxGeometry(len + 0.06, 0.02, 0.06), tm);
          seg.position.copy(a).add(c).multiplyScalar(0.5);
          seg.position.y += 0.011;
          seg.rotation.y = -Math.atan2(c.z - a.z, c.x - a.x);
          group.add(seg);
        }
        // Pastille sur les extrémités libres
        ['a', 'b'].forEach(k => {
          if (App.isPinEnd(w[k])) return;
          const pad = new THREE.Mesh(PAD_GEO, tm);
          pad.position.copy(toLocal(w[k].x, w[k].y)); pad.position.y += 0.015;
          group.add(pad);
        });
        dyn.traces.push({ mat: tm, board: b.id, wire: w.id });
      });

      // Composants
      b.components.forEach(c => {
        const def = App.getDef(c.type);
        if (!def) return;
        const g = App.defGeom(def);
        const props = App.compProps(c, def);
        const { grp, parts } = buildShape(def, g, props);
        grp.position.copy(toLocal(c.x + g.w / 2, c.y + g.h / 2));
        grp.rotation.y = -(c.rot || 0) * Math.PI / 180;
        grp.userData = { board: b.id, comp: c.id, def };
        group.add(grp);
        const key = App.Sim.compKey(b.id, c.id);
        if (parts.led) dyn.leds.push(Object.assign({ key }, parts.led));
        if (parts.lever) dyn.levers.push({ key, obj: parts.lever });
        if (parts.cap) dyn.caps.push({ key, obj: parts.cap });
        if (parts.knob) dyn.knobs.push({ key, obj: parts.knob });
        if (parts.rotor) dyn.rotors.push({ key, obj: parts.rotor });
        if (def.interactive !== 'none' || def.id === 'connector') dyn.hits.push(grp);

        // Pastilles des pôles
        def.pins.forEach(p => {
          const pw = App.pinWorld(c, p.name);
          if (!pw) return;
          const pad = new THREE.Mesh(PAD_GEO, GOLD);
          pad.position.copy(toLocal(pw.x, pw.y)); pad.position.y += 0.015;
          group.add(pad);
        });

        // Étiquette
        const text = def.id === 'connector' ? '⇄ ' + props.canal : (c.label || def.name);
        const lbl = cachedLabel(labels, text, def.id === 'connector' ? '#00e5ff' : '#33ff66', 0.45);
        lbl.position.copy(grp.position); lbl.position.y += 1.05;
        group.add(lbl);
        if (def.display === 'value' || def.display === 'motor') {
          const val = makeLabel('--', '#ffcc33', 0.45);
          val.position.copy(grp.position); val.position.y += 0.62;
          group.add(val);
          dyn.texts.push({ key, sprite: val });
        }
      });
    });

    // Câbles entre plaques (connecteurs de même canal)
    cables = new THREE.Group();
    root.add(cables);
    const chans = App.channels();
    const boardIndex = {};
    boards.forEach((b, i) => { boardIndex[b.id] = i; });
    const connPos = (entry) => {
      const pl = placed[entry.board.id], def = App.getDef('connector'), g = App.defGeom(def);
      const c = entry.comp;
      return new THREE.Vector3((c.x + g.w / 2 - pl.cx) * S, BOARD_T / 2 + 0.35, (c.y + g.h / 2 - pl.cy) * S).add(pl.origin);
    };
    connPosOf = connPos;
    localCables = null;
    Object.keys(chans).forEach((ch, ci) => {
      const list = chans[ch].slice().sort((a, b) => boardIndex[a.board.id] - boardIndex[b.board.id]);
      // un représentant par plaque, chaîné dans l'ordre des plaques
      const reps = [];
      list.forEach(e => { if (!reps.length || reps[reps.length - 1].board.id !== e.board.id) reps.push(e); });
      const color = new THREE.Color(App.channelColor(ch));
      for (let k = 0; k < reps.length - 1; k++) {
        const a = connPos(reps[k]), b = connPos(reps[k + 1]);
        const up = new THREE.Vector3(0, 0.5, 0);
        let pts;
        if (layout === 'stack') {
          // sortir par le bord latéral des plaques pour rester visible
          const pa = placed[reps[k].board.id], pb = placed[reps[k + 1].board.id];
          const side = (a.x + b.x) >= 0 ? 1 : -1;
          const edgeX = side * (Math.max(pa.W, pb.W) / 2 + 0.5 + ci * 0.3);
          pts = [a, a.clone().add(up), new THREE.Vector3(edgeX, a.y + 0.5, a.z),
            new THREE.Vector3(edgeX, b.y + 0.5, b.z), b.clone().add(up), b];
        } else {
          const mid = a.clone().add(b).multiplyScalar(0.5);
          pts = [a, a.clone().add(up), mid.add(new THREE.Vector3(0, 1.5 + ci * 0.3, 0)), b.clone().add(up), b];
        }
        const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
        const cm = mat(color, { emissive: color, emissiveIntensity: 0.15 });
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.08, 8, false), cm);
        tube.userData.canal = ch;
        cables.add(tube);
        dyn.cables.push({ mat: cm, board: reps[k].board.id, c: reps[k].comp.id, p: 'P', canal: ch });
      }
    });

    if (refit) {
      const box = new THREE.Box3().setFromObject(root);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3()).length() || 10;
      controls.target.copy(center);
      camera.position.copy(center).add(new THREE.Vector3(size * 0.45, size * 0.5, size * 0.7));
      // Brouillard et profondeur de vue proportionnels à la scène (grands projets)
      const dist = camera.position.distanceTo(center);
      fogDist = dist;
      V3.applyFog();
      camera.far = Math.max(500, dist * 6);
      camera.updateProjectionMatrix();
      controls.update();
    }
    V3.applyCables();
    dirty = false;
    needsFrame = true;
    V3.updateDynamic();
  };

  // Câbles visibles : ceux du canal isolé, sinon tous ou aucun selon l'option « câbles entre plaques »
  V3.applyCables = function () {
    if (!cables) return;
    const focus = App.state.focusCanal;
    cables.children.forEach(t => { t.visible = focus != null ? t.userData.canal === focus : App.prefs.cables3d; });
    buildLocalCables(focus);
    needsFrame = true;
  };

  // Canal isolé : arcs entre ses connecteurs d'une même plaque (chacun relié au plus
  // proche déjà relié, comme les liaisons 2D). Construits à la demande pour rester léger.
  function buildLocalCables(focus) {
    if (localCables) {
      root.remove(localCables);
      localCables.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      localCables = null;
    }
    if (focus == null || !connPosOf || !root) return;
    const byBoard = {};
    (App.channels()[focus] || []).forEach(e => (byBoard[e.board.id] = byBoard[e.board.id] || []).push(connPosOf(e)));
    const color = new THREE.Color(App.channelColor(focus));
    localCables = new THREE.Group();
    Object.values(byBoard).forEach(pts => {
      const tree = [pts[0]], rest = pts.slice(1);
      while (rest.length) {
        let best = null;
        tree.forEach(a => rest.forEach((r, i) => { const d = a.distanceTo(r); if (!best || d < best.d) best = { a, i, d }; }));
        const b = rest.splice(best.i, 1)[0], a = best.a;
        const lift = Math.min(1.5, 0.4 + best.d * 0.15);
        const mid = a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, lift, 0));
        const curve = new THREE.CatmullRomCurve3([a, a.clone().add(new THREE.Vector3(0, 0.3, 0)), mid, b.clone().add(new THREE.Vector3(0, 0.3, 0)), b], false, 'centripetal');
        localCables.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.06, 8, false), mat(color, { emissive: color, emissiveIntensity: 1 })));
        tree.push(b);
      }
    });
    root.add(localCables);
  }

  // Brouillard (assombrissement des objets éloignés) : activable dans la barre d'outils.
  // Désactivé, on le repousse à l'infini plutôt que de le retirer (pas de recompilation des matériaux).
  V3.applyFog = function () {
    if (!scene) return;
    scene.fog.near = App.prefs.fog3d ? fogDist * 1.2 : 1e9;
    scene.fog.far = App.prefs.fog3d ? fogDist * 3 : 2e9;
    needsFrame = true;
  };

  // ---- Mise à jour depuis la simulation ----
  V3.updateDynamic = function () {
    if (!dyn) return;
    const Sim = App.Sim;
    const st = (k) => Sim.states[k] || {};
    const ui = (k) => Sim.ui[k] || { on: false, pressed: false, value: 0.5 };
    dyn.leds.forEach(l => {
      const light = st(l.key).light || 0;
      l.mat.emissiveIntensity = light * 1.6;
      if (l.glow) l.glow.intensity = light * 1.5;
    });
    dyn.levers.forEach(l => { l.obj.rotation.z = ui(l.key).on ? -0.5 : 0.5; });
    dyn.caps.forEach(c => { c.obj.position.y = ui(c.key).pressed ? 0.27 : 0.34; });
    dyn.knobs.forEach(k => { k.obj.rotation.y = (0.5 - ui(k.key).value) * Math.PI * 1.5; });
    dyn.texts.forEach(t => { const s = st(t.key); t.sprite.setText(s.text != null ? String(s.text) : '--'); });
    const level = (x) => {
      const v = x.wire ? Sim.wireValue(x.board, x.wire) : Sim.valueAt(x.board, x.c, x.p);
      return v === null ? 0 : Math.min(1, Math.max(0.15, v / 5));
    };
    dyn.traces.forEach(t => { t.mat.emissiveIntensity = Sim.running ? level(t) * 0.9 : 0; });
    const focus = App.state.focusCanal;
    dyn.cables.forEach(c => {
      c.mat.emissiveIntensity = focus != null && c.canal === focus ? 1 : Sim.running ? 0.15 + level(c) * 0.8 : 0.15;
    });
  };

  function loop() {
    raf = requestAnimationFrame(loop);
    if (!visible) return;
    controls.update();
    if (App.Sim.running && dyn) {
      dyn.rotors.forEach(r => { r.obj.rotation.y += ((App.Sim.states[r.key] || {}).speed || 0) * 0.25; });
      needsFrame = true;
    }
    if (needsFrame) {
      V3.updateDynamic();
      renderer.render(scene, camera);
      needsFrame = false;
    }
  }

  // ---- Interaction ----
  function pick(e) {
    const r = renderer.domElement.getBoundingClientRect();
    const m = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(m, camera);
    const hit = raycaster.intersectObjects(dyn ? dyn.hits : [], true)[0];
    let o = hit && hit.object;
    while (o && !(o.userData && o.userData.comp)) o = o.parent;
    return o ? o.userData : null;
  }
  let downAt = null;   // position d'un clic dans le vide (pour réafficher tous les câbles)
  function onDown(e) {
    if (e.button !== 0) return;
    const u = pick(e);
    downAt = u ? null : { x: e.clientX, y: e.clientY };
    if (!u) return;
    controls.enabled = false;
    const Sim = App.Sim;
    if (u.def.id === 'connector') {
      const canal = App.connCanal(App.findComp(App.project.schematics.find(s => s.id === u.board), u.comp));
      App.setFocusCanal(App.state.focusCanal === canal ? null : canal);
    }
    if (u.def.interactive === 'switch') Sim.interact(u.board, u.comp, 'click');
    else if (u.def.interactive === 'slider') Sim.interact(u.board, u.comp, 'click');
    else if (u.def.interactive === 'button') { Sim.interact(u.board, u.comp, 'down'); pressed = u; }
    needsFrame = true;
  }
  function onUp(e) {
    if (downAt && e && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 4 && visible) App.setFocusCanal(null);
    downAt = null;
    if (pressed) { App.Sim.interact(pressed.board, pressed.comp, 'up'); pressed = null; }
    if (controls) controls.enabled = true;
    needsFrame = true;
  }

  // ---- Cycle de vie ----
  V3.show = function () {
    if (!renderer && !V3.init()) return;
    visible = true;
    V3.resize();
    if (dirty) V3.build(!root);
    needsFrame = true;
    if (!raf) loop();
  };
  V3.hide = function () { visible = false; };

  App.on('change', () => { dirty = true; if (visible) V3.build(false); });
  App.on('project', () => { dirty = true; if (visible) V3.build(true); });
  App.on('sim', () => { needsFrame = true; });
  App.on('focus', () => V3.applyCables());
  App.on('prefs', (key) => {
    if (key === 'cables3d') V3.applyCables();
    if (key === 'fog3d') V3.applyFog();
  });
  App.on('simstate', () => { needsFrame = true; });
})();
