/*
 * Éditeur de la bibliothèque : créer ses propres composants, définir leurs pôles,
 * leur rôle, leur apparence 3D et programmer leur comportement.
 */
(function () {
  const SIDES = ['left', 'right', 'top', 'bottom'];
  const SIDE_FR = { left: 'gauche', right: 'droite', top: 'haut', bottom: 'bas' };
  const TYPES = { in: 'entrée', out: 'sortie', io: 'entrée/sortie', link: 'liaison' };
  const INTERACTIVE = { none: 'aucun', switch: 'interrupteur', button: 'bouton', slider: 'curseur' };
  const DISPLAY = { none: 'aucun', led: 'voyant', value: 'valeur (state.text)', motor: 'rotation (state.speed)' };
  const SHAPES = ['chip', 'box', 'cylinder', 'resistor', 'led', 'switch', 'button', 'pot', 'motor', 'probe', 'connector'];

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const opts = (map, cur) => Object.keys(map).map(k => '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + esc(map[k]) + '</option>').join('');

  let currentId = null;
  let testState = {};

  App.tabIndent = function (ta) {
    ta.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const s = ta.selectionStart;
      ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(ta.selectionEnd);
      ta.selectionStart = ta.selectionEnd = s + 2;
      ta.dispatchEvent(new Event('input'));
    });
  };

  const Lib = App.LibraryEditor = {};

  Lib.renderList = function () {
    const ul = document.getElementById('libList');
    const cats = {};
    App.project.library.forEach(d => (cats[d.category] = cats[d.category] || []).push(d));
    ul.innerHTML = Object.keys(cats).sort().map(cat =>
      '<li class="muted" style="cursor:default">' + esc(cat) + '</li>' +
      cats[cat].map(d => '<li data-id="' + esc(d.id) + '" class="' + (d.id === currentId ? 'active' : '') + '">' +
        '<span class="swatch" style="background:' + esc(d.color) + '"></span><span class="name">' + esc(d.name) + '</span>' +
        '<span class="muted">' + d.pins.length + 'p</span></li>').join('')
    ).join('');
  };

  Lib.select = function (id) {
    currentId = id;
    testState = {};
    Lib.renderList();
    Lib.renderEditor();
  };

  Lib.create = function () {
    const n = App.project.library.filter(d => d.category === 'Perso').length + 1;
    const def = {
      id: App.uid('perso'), name: 'Mon composant ' + n, category: 'Perso', color: '#33ff66',
      description: 'Décrire ici à quoi sert le composant.',
      pins: [{ name: 'IN', side: 'left', type: 'in' }, { name: 'OUT', side: 'right', type: 'out' }],
      props: { V: 5 }, interactive: 'none', display: 'none', shape3d: 'chip',
      logic: '// inp : tensions des pôles, props : paramètres, state : mémoire, ui : contrôle, t : temps (s)\n// retourner les valeurs imposées sur les sorties\nreturn { OUT: (inp.IN || 0) > 2.5 ? props.V : 0 };'
    };
    App.project.library.push(def);
    App.changed('library');
    Lib.select(def.id);
  };

  function def() { return App.getDef(currentId); }

  Lib.renderEditor = function () {
    const box = document.getElementById('libEditor');
    const d = def();
    if (!d) {
      box.innerHTML = '<p class="muted">Sélectionner un composant à gauche, ou en créer un nouveau.</p>';
      return;
    }
    const locked = !!d.builtin;
    const inPins = d.pins.filter(p => p.type !== 'out');
    box.innerHTML =
      '<h3>' + esc(d.name) + ' <span class="muted">#' + esc(d.id) + '</span></h3>' +
      (locked ? '<p class="muted">Composant système : les pôles et le code sont verrouillés.</p>' : '') +
      '<div class="lib-grid"><div>' +
        '<div class="field"><label>nom</label><input data-f="name" value="' + esc(d.name) + '"></div>' +
        '<div class="row"><div class="field" style="flex:1"><label>catégorie</label><input data-f="category" value="' + esc(d.category) + '"></div>' +
        '<div class="field"><label>couleur</label><input type="color" data-f="color" value="' + esc(d.color) + '"></div></div>' +
        '<div class="field"><label>à quoi sert-il ?</label><textarea data-f="description" rows="3">' + esc(d.description) + '</textarea></div>' +
        '<div class="field"><label>nombre de pôles</label><input type="number" min="0" max="32" id="pinCount" value="' + d.pins.length + '"' + (locked ? ' disabled' : '') + '></div>' +
        '<table class="pins"><tr><th>nom</th><th>côté</th><th>type</th><th></th></tr>' +
        d.pins.map((p, i) => '<tr>' +
          '<td><input data-pin="' + i + '" data-k="name" value="' + esc(p.name) + '"' + (locked ? ' disabled' : '') + '></td>' +
          '<td><select data-pin="' + i + '" data-k="side"' + (locked ? ' disabled' : '') + '>' + SIDES.map(s => '<option value="' + s + '"' + (s === p.side ? ' selected' : '') + '>' + SIDE_FR[s] + '</option>').join('') + '</select></td>' +
          '<td><select data-pin="' + i + '" data-k="type"' + (locked ? ' disabled' : '') + '>' + opts(TYPES, p.type) + '</select></td>' +
          '<td>' + (locked ? '' : '<button class="mini danger" data-delpin="' + i + '">×</button>') + '</td></tr>').join('') +
        '</table>' +
        (locked ? '' : '<button id="btnAddPin">+ pôle</button>') +
        '<div class="row" style="margin-top:10px">' +
          '<div class="field" style="flex:1"><label>interaction</label><select data-f="interactive">' + opts(INTERACTIVE, d.interactive) + '</select></div>' +
          '<div class="field" style="flex:1"><label>affichage</label><select data-f="display">' + opts(DISPLAY, d.display) + '</select></div>' +
        '</div>' +
        '<div class="field"><label>forme 3D</label><select data-f="shape3d">' + SHAPES.map(s => '<option' + (s === d.shape3d ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>paramètres par défaut (JSON) — accessibles via props</label><textarea id="propsJson" class="code" rows="3">' + esc(JSON.stringify(d.props)) + '</textarea><div id="propsErr" class="muted"></div></div>' +
      '</div><div>' +
        '<div class="field"><label>aperçu</label><svg id="libPreview" class="preview-box schema-svg"></svg></div>' +
        '<div class="field"><label>programme — function (inp, props, state, ui, t) { … }</label>' +
          '<textarea id="logicCode" class="code logic"' + (locked ? ' disabled' : '') + '>' + esc(d.logic) + '</textarea></div>' +
        '<div class="field"><label>tester</label>' +
          '<div class="row" style="flex-wrap:wrap">' +
            inPins.map(p => '<span>' + esc(p.name) + ' <input class="test-in" data-p="' + esc(p.name) + '" style="width:60px" placeholder="Z"></span>').join('') +
            (d.interactive === 'switch' ? '<label><input type="checkbox" id="tUiOn"> on</label>' : '') +
            (d.interactive === 'button' ? '<label><input type="checkbox" id="tUiPressed"> appuyé</label>' : '') +
            (d.interactive === 'slider' ? '<span>valeur <input id="tUiValue" style="width:50px" value="0.5"></span>' : '') +
            '<span>t <input id="tT" style="width:50px" value="0"></span>' +
          '</div>' +
          '<div class="row" style="margin:6px 0"><button id="btnTest">▶ exécuter</button><button id="btnTestReset">vider state</button></div>' +
          '<div id="testOut" class="test-out">—</div>' +
        '</div>' +
        '<div class="row" style="flex-wrap:wrap">' +
          '<button id="btnUseComp">placer sur le schéma</button>' +
          '<button id="btnDupComp">dupliquer</button>' +
          (locked ? '' : '<button id="btnDelComp" class="danger">supprimer</button>') +
        '</div>' +
      '</div></div>';

    Lib.renderPreview();
    Lib.bindEditor(box, d);
  };

  Lib.renderPreview = function () {
    const svg = document.getElementById('libPreview');
    const d = def();
    if (!svg || !d) return;
    svg.innerHTML = '';
    const g = App.defGeom(d);
    App.drawComponent(svg, { id: 'preview', type: d.id, x: 0, y: 0, rot: 0, label: '', props: {} }, d, { mode: 'edit' });
    const pad = 40;
    svg.setAttribute('viewBox', (-pad) + ' ' + (-pad) + ' ' + (g.w + pad * 2) + ' ' + (g.h + pad * 2));
  };

  function touched(structural) {
    App.changed('library');
    Lib.renderList();
    if (structural) Lib.renderEditor(); else Lib.renderPreview();
  }

  Lib.bindEditor = function (box, d) {
    box.querySelectorAll('[data-f]').forEach(inp => {
      inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => {
        d[inp.dataset.f] = inp.value;
        touched(inp.dataset.f === 'interactive');
      });
    });

    const count = box.querySelector('#pinCount');
    count.addEventListener('change', () => {
      const n = Math.max(0, Math.min(32, parseInt(count.value, 10) || 0));
      while (d.pins.length < n) {
        let k = d.pins.length + 1, name = 'P' + k;
        while (d.pins.some(p => p.name === name)) name = 'P' + (++k);
        d.pins.push({ name, side: d.pins.length % 2 ? 'right' : 'left', type: 'in' });
      }
      d.pins.length = n;
      App.pruneWires();
      touched(true);
    });

    box.querySelectorAll('[data-pin]').forEach(inp => {
      inp.addEventListener('change', () => {
        const pin = d.pins[+inp.dataset.pin], k = inp.dataset.k;
        if (k === 'name') {
          const nv = inp.value.trim();
          if (!nv || d.pins.some(p => p !== pin && p.name === nv)) {
            App.toast('nom de pôle vide ou déjà utilisé', true);
            inp.value = pin.name;
            return;
          }
          App.renamePin(d.id, pin.name, nv);
          pin.name = nv;
        } else pin[k] = inp.value;
        touched(true);
      });
    });
    box.querySelectorAll('[data-delpin]').forEach(btn => btn.addEventListener('click', () => {
      d.pins.splice(+btn.dataset.delpin, 1);
      App.pruneWires();
      touched(true);
    }));
    const addPin = box.querySelector('#btnAddPin');
    if (addPin) addPin.addEventListener('click', () => { count.value = d.pins.length + 1; count.dispatchEvent(new Event('change')); });

    const pj = box.querySelector('#propsJson'), pe = box.querySelector('#propsErr');
    pj.addEventListener('input', () => {
      try {
        const v = JSON.parse(pj.value || '{}');
        if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('objet attendu');
        d.props = v; pe.textContent = ''; App.changed('library');
      } catch (e) { pe.textContent = '⚠ ' + e.message; }
    });

    const code = box.querySelector('#logicCode');
    App.tabIndent(code);
    code.addEventListener('input', () => { d.logic = code.value; App.changed('library'); });

    box.querySelector('#btnTest').addEventListener('click', () => Lib.runTest(box, d));
    box.querySelector('#btnTestReset').addEventListener('click', () => { testState = {}; box.querySelector('#testOut').textContent = 'state vidé'; });

    box.querySelector('#btnUseComp').addEventListener('click', () => {
      App.showTab('schema');
      App.schemaView.addAt(d.id);
    });
    box.querySelector('#btnDupComp').addEventListener('click', () => {
      const copy = App.clone(d);
      copy.id = App.uid('perso'); copy.name = d.name + ' (copie)'; delete copy.builtin;
      App.project.library.push(copy);
      App.changed('library');
      Lib.select(copy.id);
    });
    const del = box.querySelector('#btnDelComp');
    if (del) del.addEventListener('click', () => {
      const uses = App.project.schematics.reduce((n, s) => n + s.components.filter(c => c.type === d.id).length, 0);
      if (!confirm('Supprimer « ' + d.name + ' » ?' + (uses ? '\n' + uses + ' instance(s) seront retirées des schémas.' : ''))) return;
      App.project.schematics.forEach(s => s.components.filter(c => c.type === d.id).forEach(c => App.removeComponent(s, c.id)));
      App.project.library = App.project.library.filter(x => x !== d);
      App.changed('library');
      Lib.select(null);
    });
  };

  Lib.runTest = function (box, d) {
    const out = box.querySelector('#testOut');
    const inp = {};
    box.querySelectorAll('.test-in').forEach(i => { inp[i.dataset.p] = i.value.trim() === '' ? null : +i.value; });
    const ui = {};
    const on = box.querySelector('#tUiOn'), pr = box.querySelector('#tUiPressed'), va = box.querySelector('#tUiValue');
    if (on) ui.on = on.checked;
    if (pr) ui.pressed = pr.checked;
    if (va) ui.value = +va.value || 0;
    try {
      const r = App.Sim.testLogic(d, inp, {}, ui, +box.querySelector('#tT').value || 0, testState);
      testState = r.state;
      out.classList.remove('err');
      out.textContent = 'sorties : ' + JSON.stringify(r.out) + '\nstate   : ' + JSON.stringify(r.state);
    } catch (e) {
      out.classList.add('err');
      out.textContent = '⚠ ' + e.message;
    }
  };

  Lib.show = function () {
    if (currentId && !def()) currentId = null;
    Lib.renderList();
    Lib.renderEditor();
  };

  document.getElementById('libList').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-id]');
    if (li) Lib.select(li.dataset.id);
  });
  document.getElementById('btnNewComp').addEventListener('click', Lib.create);
})();
