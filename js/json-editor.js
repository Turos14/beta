/*
 * Édition du projet en JSON directement dans l'application.
 */
(function () {
  const ta = document.getElementById('jsonEditor');
  const status = document.getElementById('jsonStatus');
  let edited = false;
  let timer = null;

  const J = App.JsonEditor = {};

  function setStatus(text, cls) {
    status.textContent = text;
    status.className = 'status ' + (cls || '');
  }

  // Position (ligne:colonne) d'une erreur de parsing si le navigateur l'indique
  function locate(msg) {
    const m = /position (\d+)/.exec(msg);
    if (!m) return '';
    const before = ta.value.slice(0, +m[1]).split('\n');
    return ' (ligne ' + before.length + ', col ' + (before[before.length - 1].length + 1) + ')';
  }

  function parse() {
    try {
      const obj = JSON.parse(ta.value);
      App.normalizeProject(App.clone(obj));
      return { obj };
    } catch (e) {
      return { error: e.message + locate(e.message) };
    }
  }

  J.reload = function () {
    ta.value = JSON.stringify(App.project, null, 2);
    edited = false;
    setStatus('synchronisé avec le projet', 'ok');
  };

  J.show = function () { if (!edited) J.reload(); };

  J.apply = function () {
    const r = parse();
    if (r.error) { setStatus('⚠ ' + r.error, 'err'); App.toast('JSON invalide', true); return; }
    App.Sim.stop();
    App.setProject(r.obj, true);
    J.reload();
    App.toast('JSON appliqué au projet');
  };

  J.format = function () {
    const r = parse();
    if (r.error) { setStatus('⚠ ' + r.error, 'err'); return; }
    ta.value = JSON.stringify(r.obj, null, 2);
  };

  App.tabIndent(ta);
  ta.addEventListener('input', () => {
    edited = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const r = parse();
      setStatus(r.error ? '⚠ ' + r.error : 'JSON valide — modifications non appliquées', r.error ? 'err' : '');
    }, 250);
  });
  ta.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); J.apply(); }
  });

  document.getElementById('btnJsonApply').addEventListener('click', J.apply);
  document.getElementById('btnJsonFormat').addEventListener('click', J.format);
  document.getElementById('btnJsonReload').addEventListener('click', J.reload);
})();
