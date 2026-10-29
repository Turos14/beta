/*
 * Contrôleur principal : onglets, liste des plaques, palette, inspecteur,
 * panneau du simulateur, import / export.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let tab = 'schema';

  // ---- Utilitaires ----
  let toastTimer = null;
  App.toast = function (msg, err) {
    const t = $('toast');
    t.textContent = msg;
    t.className = 'toast show' + (err ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = 'toast'; }, 2200);
  };

  // ---- Onglets ----
  App.showTab = function (name) {
    tab = name;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
    $('palette').style.display = $('paletteTitle').style.display = name === 'schema' ? '' : 'none';
    $('sidebar').style.display = name === 'library' || name === 'json' ? 'none' : '';
    if (name === 'view3d') App.View3D.show(); else App.View3D.hide();
    if (name === 'schema') { App.schemaView.render(); renderInspector(); }
    if (name === 'sim') { App.simView.render(); renderSimPanel(); }
    if (name === 'library') App.LibraryEditor.show();
    if (name === 'json') App.JsonEditor.show();
  };

  // ---- Plaques ----
  function renderBoards() {
    const cur = App.board();
    $('boardList').innerHTML = App.project.schematics.map((s, i) =>
      '<li data-id="' + s.id + '" class="' + (s.id === cur.id ? 'active' : '') + '">' +
      '<span class="name" title="double-clic pour renommer">' + esc(s.name) + '</span>' +
      '<span class="muted">' + s.components.length + '</span>' +
      (i > 0 ? '<button class="mini" data-act="up" title="monter">↑</button>' : '') +
      '<button class="mini" data-act="rename" title="renommer">✎</button>' +
      '<button class="mini danger" data-act="del" title="supprimer">×</button></li>').join('');
  }

  function selectBoard(id) {
    App.state.boardId = id;
    App.state.selection = null;
    App.schemaView.cancelWire();
    renderBoards();
    if (tab === 'schema') { App.schemaView.render(); renderInspector(); }
    if (tab === 'sim') { App.simView.render(); renderSimPanel(); }
  }

  $('boardList').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    const id = li.dataset.id, act = e.target.dataset.act;
    const list = App.project.schematics;
    const idx = list.findIndex(s => s.id === id);
    if (act === 'del') {
      if (list.length === 1) return App.toast('il faut au moins un schéma', true);
      if (!confirm('Supprimer le schéma « ' + list[idx].name + ' » ?')) return;
      list.splice(idx, 1);
      if (App.state.boardId === id) App.state.boardId = list[0].id;
      App.changed('board');
      selectBoard(App.state.boardId);
    } else if (act === 'rename') {
      renameBoard(list[idx]);
    } else if (act === 'up') {
      list.splice(idx - 1, 0, list.splice(idx, 1)[0]);
      App.changed('board');
    } else selectBoard(id);
  });
  $('boardList').addEventListener('dblclick', (e) => {
    const li = e.target.closest('li[data-id]');
    if (li) renameBoard(App.project.schematics.find(s => s.id === li.dataset.id));
  });
  function renameBoard(b) {
    const n = prompt('Nom du schéma', b.name);
    if (n && n.trim()) { b.name = n.trim(); App.changed('board'); }
  }
  $('btnAddBoard').addEventListener('click', () => { App.addBoard(); selectBoard(App.state.boardId); });

  // ---- Palette ----
  function renderPalette() {
    const cats = {};
    App.project.library.forEach(d => (cats[d.category] = cats[d.category] || []).push(d));
    $('palette').innerHTML = Object.keys(cats).sort().map(cat =>
      '<li class="muted" style="cursor:default">' + esc(cat) + '</li>' +
      cats[cat].map(d => '<li draggable="true" data-type="' + esc(d.id) + '" title="' + esc(d.description) + '">' +
        '<span class="swatch" style="background:' + esc(d.color) + '"></span>' + esc(d.name) + '</li>').join('')).join('');
  }
  $('palette').addEventListener('dragstart', (e) => {
    const li = e.target.closest('li[data-type]');
    if (li) e.dataTransfer.setData('text/plain', li.dataset.type);
  });
  $('palette').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-type]');
    if (li) App.schemaView.addAt(li.dataset.type);
  });

  // ---- Inspecteur (mode édition) ----
  function renderInspector() {
    const box = $('inspector'), b = App.board(), sel = App.state.selection;
    if (sel && sel.kind === 'comp') {
      const c = App.findComp(b, sel.id), def = c && App.getDef(c.type);
      if (c && def) return inspectComp(box, b, c, def);
    }
    if (sel && sel.kind === 'wire') {
      const w = b.wires.find(x => x.id === sel.id);
      if (w) {
        const name = (e) => { const c = App.findComp(b, e.c); return (c && (c.label || (App.getDef(c.type) || {}).name)) + '.' + e.p; };
        box.innerHTML = '<h3>Fil</h3><p>' + esc(name(w.a)) + '<br>→ ' + esc(name(w.b)) + '</p><button id="insDelWire" class="danger">supprimer le fil</button>';
        $('insDelWire').onclick = deleteSelection;
        return;
      }
    }
    // Rien de sélectionné : infos de la plaque et liaisons inter-plaques
    const chans = App.channels();
    box.innerHTML = '<h3>Plaque</h3>' +
      '<div class="field"><label>nom</label><input id="insBoardName" value="' + esc(b.name) + '"></div>' +
      '<p class="muted">' + b.components.length + ' composant(s), ' + b.wires.length + ' fil(s)</p>' +
      '<h3>Liaisons inter-plaques</h3>' +
      (Object.keys(chans).length ? Object.keys(chans).map(ch => {
        const boards = [...new Set(chans[ch].map(e => e.board.name))];
        return '<p><b>' + esc(ch) + '</b> : ' + boards.map(esc).join(' ⇄ ') + (boards.length < 2 ? ' <span class="muted">(non relié)</span>' : '') + '</p>';
      }).join('') : '<p class="muted">Ajouter un « Connecteur » (catégorie Liaison) sur deux plaques avec le même canal pour les relier.</p>');
    $('insBoardName').oninput = (e) => { b.name = e.target.value; App.changed('board'); };
  }

  function inspectComp(box, b, c, def) {
    const props = App.compProps(c, def);
    const connections = (p) => b.wires.filter(w => (w.a.c === c.id && w.a.p === p) || (w.b.c === c.id && w.b.p === p)).length;
    box.innerHTML = '<h3>' + esc(def.name) + '</h3>' +
      '<p class="muted">' + esc(def.description) + '</p>' +
      (def.id !== 'connector' ? '<div class="field"><label>étiquette</label><input id="insLabel" value="' + esc(c.label) + '" placeholder="' + esc(def.name) + '"></div>' : '') +
      Object.keys(def.props).map(k => {
        const v = props[k];
        const type = k === 'couleur' ? 'color' : typeof def.props[k] === 'number' ? 'number' : 'text';
        return '<div class="field"><label>' + esc(k) + (def.id === 'connector' && k === 'canal' ? ' (même canal = relié)' : '') + '</label>' +
          '<input data-prop="' + esc(k) + '" type="' + type + '" step="any" value="' + esc(v) + '"></div>';
      }).join('') +
      '<div class="field"><label>pôles</label>' + def.pins.map(p =>
        '<div class="row"><span style="flex:1">' + esc(p.name) + '</span><span class="muted">' + p.type + ' · ' + connections(p.name) + ' fil(s)</span></div>').join('') + '</div>' +
      '<div class="row"><button id="insRot">pivoter 90°</button><button id="insDel" class="danger">supprimer</button></div>' +
      '<p class="muted" style="margin-top:10px">touches : R pivoter · Suppr effacer · Échap annuler</p>';
    const lbl = $('insLabel');
    if (lbl) lbl.oninput = () => { c.label = lbl.value; App.changed('label'); };
    box.querySelectorAll('[data-prop]').forEach(inp => {
      inp.oninput = () => {
        const k = inp.dataset.prop;
        c.props[k] = typeof def.props[k] === 'number' ? (+inp.value || 0) : inp.value;
        App.changed('props');
      };
    });
    $('insRot').onclick = rotateSelection;
    $('insDel').onclick = deleteSelection;
  }

  function deleteSelection() {
    const b = App.board(), sel = App.state.selection;
    if (!sel) return;
    if (sel.kind === 'comp') App.removeComponent(b, sel.id);
    else { b.wires = b.wires.filter(w => w.id !== sel.id); App.changed('wire'); }
    App.state.selection = null;
    App.emit('select');
  }
  function rotateSelection() {
    const sel = App.state.selection;
    if (!sel || sel.kind !== 'comp') return;
    const c = App.findComp(App.board(), sel.id);
    c.rot = ((c.rot || 0) + 90) % 360;
    App.changed('rotate');
  }

  // ---- Panneau du simulateur ----
  function renderSimPanel() {
    const box = $('simPanel');
    let html = '<h3>Contrôles</h3>';
    let any = false;
    App.project.schematics.forEach(s => {
      const items = s.components.filter(c => { const d = App.getDef(c.type); return d && (d.interactive !== 'none' || d.display !== 'none'); });
      if (!items.length) return;
      any = true;
      html += '<div class="side-title">// ' + esc(s.name) + '</div>';
      items.forEach(c => {
        const d = App.getDef(c.type), key = App.Sim.compKey(s.id, c.id);
        const name = esc(c.label || d.name);
        let ctl = '';
        if (d.interactive === 'switch') ctl = '<button data-sw="' + key + '"></button>';
        if (d.interactive === 'button') ctl = '<button data-bt="' + key + '">appuyer</button>';
        if (d.interactive === 'slider') ctl = '<input type="range" min="0" max="1" step="0.01" data-sl="' + key + '" style="width:110px">';
        html += '<div class="row field"><span style="flex:1">' + name + '</span>' + ctl + '<span class="readout" data-ro="' + key + '"></span></div>';
      });
    });
    if (!any) html += '<p class="muted">Aucun composant interactif ou afficheur.</p>';
    html += '<h3 style="margin-top:12px">Erreurs</h3><div id="simErrors" class="muted">—</div>' +
      '<p class="muted" style="margin-top:12px">Couleur des fils : vert vif = tension &gt; 0,5 V, sombre = 0 V, pointillé gris = flottant. Survoler un fil pour voir sa tension.</p>';
    box.innerHTML = html;

    const split = (k) => { const i = k.indexOf('/'); return [k.slice(0, i), k.slice(i + 1)]; };
    box.querySelectorAll('[data-sw]').forEach(b => b.onclick = () => App.Sim.interact(...split(b.dataset.sw), 'click'));
    box.querySelectorAll('[data-bt]').forEach(b => {
      b.onpointerdown = () => App.Sim.interact(...split(b.dataset.bt), 'down');
      b.onpointerup = b.onpointerleave = () => App.Sim.interact(...split(b.dataset.bt), 'up');
    });
    box.querySelectorAll('[data-sl]').forEach(r => r.oninput = () => App.Sim.interact(...split(r.dataset.sl), 'set', +r.value));
    updateSimPanel();
  }

  function updateSimPanel() {
    const box = $('simPanel'), Sim = App.Sim;
    box.querySelectorAll('[data-sw]').forEach(b => { b.textContent = Sim.uiFor(b.dataset.sw).on ? 'ON' : 'OFF'; b.classList.toggle('active', Sim.uiFor(b.dataset.sw).on); });
    box.querySelectorAll('[data-sl]').forEach(r => { if (document.activeElement !== r) r.value = Sim.uiFor(r.dataset.sl).value; });
    box.querySelectorAll('[data-ro]').forEach(s => {
      const st = Sim.states[s.dataset.ro] || {};
      s.textContent = st.text != null ? st.text : st.light != null ? (st.light > 0 ? '● allumée' : '○ éteinte') : '';
    });
    const errs = Object.keys(Sim.errors);
    const e = $('simErrors');
    if (e) e.innerHTML = errs.length ? errs.map(k => '<div style="color:var(--err)">' + esc(k) + ' : ' + esc(Sim.errors[k]) + '</div>').join('') : '—';
    $('simStatus').textContent = Sim.running ? 'en cours · t = ' + Sim.t.toFixed(1) + ' s' : 'arrêté';
    $('simStatus').className = 'status' + (Sim.running ? ' ok' : '');
  }

  function updateSimButtons() {
    ['btnSimToggle', 'btnSimToggle3d'].forEach(id => {
      $(id).textContent = App.Sim.running ? '■ arrêter' : '▶ simuler';
      $(id).classList.toggle('active', App.Sim.running);
    });
  }

  // ---- Import / export ----
  function download() {
    const name = (App.project.name || 'projet').replace(/[^\w\-]+/g, '_') + '.json';
    const blob = new Blob([JSON.stringify(App.project, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    App.toast('téléchargé : ' + name);
  }

  $('btnDownload').onclick = download;
  $('btnImport').onclick = () => $('fileInput').click();
  $('fileInput').onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        App.Sim.stop();
        App.setProject(JSON.parse(r.result));
        App.toast('projet importé');
      } catch (err) { App.toast('import impossible : ' + err.message, true); }
    };
    r.readAsText(f);
    e.target.value = '';
  };
  $('btnNew').onclick = () => {
    const choice = prompt('Nouveau projet : taper « vide » ou « demo »', 'vide');
    if (!choice) return;
    App.Sim.stop();
    App.setProject(choice.trim().toLowerCase().startsWith('d') ? App.demoProject() : App.emptyProject());
  };
  $('projectName').oninput = (e) => { App.project.name = e.target.value; App.changed('name'); };

  // ---- Barres d'outils ----
  document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => App.showTab(b.dataset.tab));
  $('btnRotate').onclick = rotateSelection;
  $('btnDelete').onclick = deleteSelection;
  $('btnFit').onclick = () => App.schemaView.fit();
  $('btnSimToggle').onclick = $('btnSimToggle3d').onclick = () => App.Sim.toggle();
  $('btnSimReset').onclick = () => App.Sim.reset();

  document.addEventListener('keydown', (e) => {
    if (tab !== 'schema' || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelection(); }
    else if (e.key === 'r' || e.key === 'R') rotateSelection();
    else if (e.key === 'Escape') {
      if (!App.schemaView.cancelWire()) { App.state.selection = null; App.emit('select'); }
    }
  });
  window.addEventListener('resize', () => {
    if (tab === 'schema') App.schemaView.applyView();
    if (tab === 'sim') App.simView.applyView();
  });

  // ---- Événements du modèle ----
  App.on('change', (reason) => {
    renderBoards();
    if (reason === 'library' || reason === 'project') renderPalette();
    if (tab === 'schema') App.schemaView.render();
    if (tab === 'sim') App.simView.render();
    if (reason === 'comp' || reason === 'wire' || reason === 'board' || reason === 'project') {
      if (tab === 'schema') renderInspector();
      if (tab === 'sim') renderSimPanel();
    }
  });
  App.on('select', () => { App.schemaView.render(); renderInspector(); });
  App.on('project', () => {
    $('projectName').value = App.project.name;
    renderPalette();
    App.schemaView.views = {};
    App.simView.views = {};
    App.JsonEditor.reload();
  });
  App.on('sim', () => {
    if (tab === 'sim') { App.simView.render(); updateSimPanel(); }
  });
  App.on('simstate', () => { updateSimButtons(); updateSimPanel(); if (tab === 'sim') App.simView.render(); });

  // ---- Démarrage ----
  App.schemaView = new App.SchematicView($('schemaSvg'), 'edit');
  App.simView = new App.SchematicView($('simSvg'), 'sim');
  let initial = App.loadLocal();
  try { App.normalizeProject(App.clone(initial)); } catch (e) { initial = null; }
  App.setProject(initial || App.demoProject());
  App.showTab('schema');
})();
