/*
 * Cartes programmables en C++ (Arduino) : ESP32 avec WiFi simulé.
 *
 * Le programme (setup / loop) est traduit en JavaScript par un transpileur qui couvre
 * le C++ courant des croquis Arduino : types, tableaux, fonctions, #define, enum,
 * casts, String, Serial, WiFi, WiFiUDP. Chaque fonction devient un générateur :
 * delay() suspend le programme sans bloquer la page, et les boucles rendent la main
 * au simulateur quand elles tournent trop longtemps sans attendre.
 *
 * Exécution : à chaque image, le simulateur appelle rt.run(t) pour chaque carte (le
 * programme avance jusqu'au temps t), puis évalue le circuit avec les sorties de la
 * carte. digitalRead / analogRead lisent les tensions du dernier état stable.
 *
 * WiFi : les cartes connectées au même SSID forment un réseau (adresses 192.168.1.x,
 * ou 192.168.4.x derrière un point d'accès softAP) et s'échangent des paquets WiFiUDP,
 * quelle que soit leur plaque.
 */
(function () {
  const Ard = App.Arduino = {};
  const VCC = 3.3;
  const OPS_LIMIT = 20000;    // tours de boucle par image avant de rendre la main
  const SERIAL_MAX = 20000;   // caractères gardés dans le moniteur série

  // Broches de l'ESP32 DevKit (GPIO utilisables) ; 34 à 39 : entrées seules
  const GPIO = [0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35, 36, 39];
  const INPUT_ONLY = [34, 35, 36, 39];
  Ard.GPIO = GPIO;
  Ard.INPUT_ONLY = INPUT_ONLY;

  // ================= Transpileur C++ → JavaScript =================

  const TYPES = new Set(['void', 'int', 'long', 'short', 'unsigned', 'signed', 'float', 'double', 'bool', 'boolean',
    'char', 'byte', 'word', 'size_t', 'String', 'auto', 'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t',
    'int8_t', 'int16_t', 'int32_t', 'int64_t']);
  const QUAL = new Set(['const', 'static', 'volatile', 'inline', 'constexpr', 'extern', 'register']);
  const INTS = new Set(['int', 'long', 'short', 'unsigned', 'signed', 'char', 'byte', 'word', 'size_t',
    'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t']);
  const CLASSES = new Set(['WiFiUDP', 'IPAddress']);
  const UNSUPPORTED_TYPES = new Set(['WiFiClient', 'WiFiServer', 'WebServer', 'HTTPClient', 'WiFiClientSecure',
    'AsyncWebServer', 'Servo', 'Preferences', 'BluetoothSerial']);
  const UNSUPPORTED_KW = new Set(['struct', 'class', 'template', 'typedef', 'namespace', 'union', 'goto', 'new', 'delete', 'operator']);
  // Identifiants C++ valides mais réservés en JavaScript : renommés
  const JS_RESERVED = new Set(['function', 'let', 'var', 'in', 'of', 'typeof', 'instanceof', 'with', 'arguments',
    'eval', 'await', 'export', 'import', 'super', 'undefined', 'NaN', 'Infinity', 'debugger', 'finally',
    'implements', 'interface', 'package', 'Math', 'Object', 'Array', 'Number', 'JSON', 'window', 'document', 'App']);
  const GEN_BUILTINS = new Set(['delay', 'delayMicroseconds']);
  const IN_PLACE = { trim: 'trim', toUpperCase: 'toUpperCase', toLowerCase: 'toLowerCase', replace: 'replaceAll' };
  const OPS = ['<<=', '>>=', '->', '::', '++', '--', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||',
    '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^='];

  function CppError(msg, line) {
    const e = new Error(msg + (line ? ' (ligne ' + line + ')' : ''));
    e.cppLine = line;
    return e;
  }

  function lex(src) {
    const toks = [];
    let i = 0, line = 1;
    const push = (t, v, l) => toks.push({ t, v, line: l || line });
    while (i < src.length) {
      const c = src[i];
      if (c === '\n') { push('ws', '\n'); line++; i++; continue; }
      if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v') {
        let j = i; while (j < src.length && /[ \t\r\f\v]/.test(src[j])) j++;
        push('ws', src.slice(i, j)); i = j; continue;
      }
      if (src.startsWith('//', i)) {
        let j = src.indexOf('\n', i); if (j < 0) j = src.length;
        push('ws', src.slice(i, j)); i = j; continue;
      }
      if (src.startsWith('/*', i)) {
        let j = src.indexOf('*/', i + 2); j = j < 0 ? src.length : j + 2;
        const v = src.slice(i, j), l = line;
        line += (v.match(/\n/g) || []).length;
        push('ws', v.replace(/[^\n]/g, ''), l); i = j; continue;
      }
      if (c === '#') {
        // directive du préprocesseur (les lignes terminées par \ continuent)
        let j = i;
        while (true) {
          let k = src.indexOf('\n', j); if (k < 0) k = src.length;
          if (src[k - 1] === '\\' && k < src.length) { j = k + 1; continue; }
          j = k; break;
        }
        const v = src.slice(i, j), l = line;
        line += (v.match(/\n/g) || []).length;
        push('pp', v.replace(/\\\n/g, ' '), l); i = j; continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        let j = i; while (j < src.length && /\w/.test(src[j])) j++;
        push('id', src.slice(i, j)); i = j; continue;
      }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) {
        const m = /^(0[xX][0-9a-fA-F]+|0[bB][01]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)([uUlLfF]*)/.exec(src.slice(i));
        push('num', m[1]); i += m[0].length; continue;
      }
      if (c === '"' || c === '\'') {
        let j = i + 1;
        while (j < src.length && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
        if (src[j] !== c) throw CppError('chaîne non terminée', line);
        push(c === '"' ? 'str' : 'chr', src.slice(i, j + 1)); i = j + 1; continue;
      }
      const op = OPS.find(o => src.startsWith(o, i)) || c;
      push('op', op); i += op.length;
    }
    return toks;
  }

  // #define (sans paramètres) → constante ; #include et les autres directives sont ignorés
  function preprocess(toks) {
    const out = [];
    toks.forEach(t => {
      if (t.t !== 'pp') { out.push(t); return; }
      const m = /^#\s*(\w+)\s*(.*)$/s.exec(t.v);
      const nl = { t: 'ws', v: '\n'.repeat((t.v.match(/\n/g) || []).length), line: t.line };
      if (m && m[1] === 'define') {
        const d = /^(\w+)(\()?\s*(.*)$/s.exec(m[2]);
        if (!d) throw CppError('#define invalide', t.line);
        if (d[2]) throw CppError('les macros avec paramètres (#define ' + d[1] + '(…)) ne sont pas prises en charge : utiliser une fonction', t.line);
        const body = d[3].replace(/\/\/.*$/, '').trim();
        lex('const ' + d[1] + ' = ' + (body || 'true') + ';').forEach(x => { x.line = t.line; out.push(x); });
      }
      out.push(nl);
    });
    return out;
  }

  function transpile(src) {
    const toks = preprocess(lex(src));
    const n = toks.length;
    const V = i => (i >= 0 && i < n ? toks[i].v : '');
    const T = i => (i >= 0 && i < n ? toks[i].t : '');
    const L = i => (i >= 0 && i < n ? toks[i].line : (n ? toks[n - 1].line : 1));
    const nx = i => { i++; while (i < n && toks[i].t === 'ws') i++; return i; };
    const pv = i => { i--; while (i >= 0 && toks[i].t === 'ws') i--; return i; };
    const isOp = (i, v) => T(i) === 'op' && V(i) === v;
    const userTypes = new Set();     // enum
    const isTypeWord = v => TYPES.has(v) || QUAL.has(v) || CLASSES.has(v) || userTypes.has(v);
    const isTypeTok = i => T(i) === 'id' && isTypeWord(V(i));

    function match(i) {
      const open = V(i), close = { '(': ')', '[': ']', '{': '}' }[open];
      let d = 0;
      for (let j = i; j < n; j++) {
        if (toks[j].t !== 'op') continue;
        if (toks[j].v === open) d++;
        else if (toks[j].v === close && --d === 0) return j;
      }
      throw CppError('« ' + open + ' » jamais refermé', L(i));
    }
    // Fin d'expression : , ou ; au même niveau, ou parenthèse fermante du niveau englobant
    function exprEnd(i) {
      let d = 0;
      for (let j = i; j < n; j++) {
        if (toks[j].t !== 'op') continue;
        const v = toks[j].v;
        if (v === '(' || v === '[' || v === '{') d++;
        else if (v === ')' || v === ']' || v === '}') { if (d === 0) return j; d--; }
        else if (d === 0 && (v === ',' || v === ';')) return j;
      }
      return n;
    }
    // Fin d'une instruction simple (corps de boucle sans accolades) : index du ; final
    function stmtEnd(i) {
      if (isOp(i, '{')) return match(i);
      let d = 0;
      for (let j = i; j < n; j++) {
        if (toks[j].t !== 'op') continue;
        const v = toks[j].v;
        if (v === '(' || v === '[' || v === '{') d++;
        else if (v === ')' || v === ']' || v === '}') d--;
        else if (d === 0 && v === ';') return j;
      }
      return n - 1;
    }
    // Fin de l'opérande d'un cast : préfixes, primaire, puis suffixes (. -> () [])
    function operandEnd(i) {
      while (T(i) === 'op' && ['-', '+', '!', '~', '*', '&'].includes(V(i))) i = nx(i);
      let e;
      if (isOp(i, '(')) e = match(i);
      else if (['id', 'num', 'str', 'chr'].includes(T(i))) e = i;
      else throw CppError('cast incomplet', L(i));
      for (;;) {
        const k = nx(e);
        if ((isOp(k, '.') || isOp(k, '->')) && T(nx(k)) === 'id') e = nx(k);
        else if (isOp(k, '(') || isOp(k, '[')) e = match(k);
        else return e;
      }
    }
    const raw = (a, b) => { let s = ''; for (let k = a; k < b; k++) if (toks[k].t !== 'ws') s += toks[k].v; return s; };
    const newlines = (a, b) => { let s = ''; for (let k = a; k < b; k++) if (toks[k].t === 'ws') s += toks[k].v.replace(/[^\n]/g, ''); return s; };
    const safe = v => (JS_RESERVED.has(v) ? v + '_' : v);

    // ---- Repérage préalable : enum, fonctions définies par le programme ----
    const userFns = new Set();
    let depth = 0;
    for (let i = 0; i < n; i++) {
      if (isOp(i, '{')) depth++;
      else if (isOp(i, '}')) depth--;
      else if (T(i) === 'id' && V(i) === 'enum') {
        let j = nx(i);
        if (V(j) === 'class') j = nx(j);
        if (T(j) === 'id') userTypes.add(V(j));
      } else if (depth === 0 && T(i) === 'id' && !isTypeWord(V(i)) && isOp(nx(i), '(')) {
        const p = pv(i);
        if (p >= 0 && (isTypeTok(p) || isOp(p, '*') || isOp(p, '&')) && isOp(nx(match(nx(i))), '{')) userFns.add(V(i));
      }
    }

    // ---- Annotations posées en avance (texte avant / après un jeton, jetons sautés) ----
    const before = {}, after = {}, skip = {};
    const addB = (k, s) => { before[k] = (before[k] || '') + s; };
    const addA = (k, s) => { after[k] = s + (after[k] || ''); };
    const loopBrace = {}, doBrace = {}, declComma = {}, assignAt = {}, genParen = {};

    const out = [];
    const braces = [];               // 'block' | 'func' | 'do' | 'init'
    const parens = [];               // { gen, loop, ctrl }
    const scopes = [{}];             // nom -> type ('int', 'float', 'String'…)
    let pendingScope = null, pendingFnInt = null;
    const fnInt = [];                // fonction courante : retourne un entier ?
    let stmt = true, afterDo = false, pendingLoop = null, pendingCtrl = false;

    const kindOf = words => {
      const base = words.filter(w => !QUAL.has(w)).pop() || 'int';
      if (userTypes.has(base)) return { base, kind: 'int' };
      if (INTS.has(base)) return { base, kind: 'int' };
      if (base === 'float' || base === 'double') return { base, kind: 'float' };
      if (base === 'bool' || base === 'boolean') return { base, kind: 'bool' };
      if (base === 'String') return { base, kind: 'String' };
      if (CLASSES.has(base)) return { base, kind: 'class' };
      return { base, kind: base };
    };
    // scopes : nom -> { kind, js } (js = nom renommé, pour les variables static locales)
    const lookup = name => { for (let s = scopes.length - 1; s >= 0; s--) if (name in scopes[s]) return scopes[s][name]; return null; };
    const ident = v => { const e = lookup(v); return e && e.js ? e.js : safe(v); };
    let prelude = '', statics = 0;

    // static locale : variable globale cachée, initialisée une seule fois
    function staticDecl(i, info) {
      const end = (() => { let k = info.nameIdx; while (k < n && !isOp(k, ';')) k = isOp(k, '(') || isOp(k, '[') || isOp(k, '{') ? match(k) + 1 : k + 1; return k; })();
      let k = info.nameIdx;
      for (;;) {
        const name = V(k), js = '__st' + (++statics) + '_' + name;
        let m = nx(k);
        const dims = [];
        while (isOp(m, '[')) { const c = match(m); dims.push(raw(m + 1, c) || '0'); m = nx(c); }
        let init = dims.length ? '__arr([' + dims.join(', ') + '], () => ' + defaultValue(info) + ')' : defaultValue(info);
        if (isOp(m, '=')) { const e = exprEnd(nx(m)); init = raw(nx(m), e).replace(/\{/g, '[').replace(/\}/g, ']'); m = e; }
        prelude += 'let ' + js + ' = ' + init + ';\n';
        scopes[scopes.length - 1][name] = { kind: info.kind, js };
        if (!isOp(m, ',')) break;
        k = nx(m);
      }
      out.push(newlines(i, end));
      stmt = true;
      return end;
    }

    function declInfo(i) {
      let j = i;
      const words = [];
      while (isTypeTok(j)) { words.push(V(j)); j = nx(j); }
      if (!words.length || words.every(w => QUAL.has(w))) return null;
      let ptr = false;
      while (isOp(j, '*') || isOp(j, '&')) { ptr = ptr || isOp(j, '*'); j = nx(j); }
      if (T(j) !== 'id' || isTypeWord(V(j))) return null;
      const k = kindOf(words);
      if (ptr) k.kind = k.base === 'char' ? 'String' : 'ptr';
      return Object.assign({ words, nameIdx: j }, k);
    }

    function params(a, b) {
      const names = [], scope = {};
      let parts = [[]], d = 0;
      for (let k = a + 1; k < b; k++) {
        if (toks[k].t === 'ws') continue;
        const v = toks[k].v;
        if (toks[k].t === 'op' && '([{'.includes(v)) d++;
        if (toks[k].t === 'op' && ')]}'.includes(v)) d--;
        if (d === 0 && isOp(k, ',')) { parts.push([]); continue; }
        parts[parts.length - 1].push(k);
      }
      parts.forEach(p => {
        if (!p.length || (p.length === 1 && V(p[0]) === 'void')) return;
        const eq = p.findIndex(k => isOp(k, '='));
        const head = eq < 0 ? p : p.slice(0, eq);
        const words = head.filter(k => isTypeTok(k)).map(V);
        const nameK = head.filter(k => T(k) === 'id' && !isTypeWord(V(k))).pop();
        if (nameK === undefined) throw CppError('paramètre sans nom', L(p[0]));
        const name = V(nameK);
        scope[name] = { kind: kindOf(words).kind };
        names.push(safe(name) + (eq < 0 ? '' : ' = ' + raw(p[eq] + 1, p[p.length - 1] + 1)));
      });
      return { text: names.join(', '), scope };
    }

    const defaultValue = info => info.kind === 'String' ? '""' : info.kind === 'bool' ? 'false'
      : info.kind === 'class' ? 'new ' + info.base + '()' : '0';

    // Un déclarateur (nom [dims] [= init]) ; renvoie l'index du dernier jeton consommé
    function declarator(j, info) {
      if (T(j) !== 'id') throw CppError('nom de variable attendu', L(j));
      const name = V(j);
      let m = nx(j);
      const dims = [];
      while (isOp(m, '[')) { const c = match(m); dims.push(raw(m + 1, c) || '0'); m = nx(c); }
      scopes[scopes.length - 1][name] = { kind: info.kind };
      out.push(safe(name) + ' = ');
      if (isOp(m, '=')) {
        const e = exprEnd(nx(m));
        if (!dims.length && info.kind === 'int') { out.push('__i('); addB(e, ')'); }
        if (isOp(e, ',')) declComma[e] = info;
        return m;
      }
      if (isOp(m, '(')) {
        // constructeur : IPAddress ip(192, 168, 1, 10);
        out.push(info.kind === 'class' ? 'new ' + info.base : info.kind === 'String' ? 'String' : '');
        const c = match(m);
        if (isOp(nx(c), ',')) declComma[nx(c)] = info;
        return pv(m);
      }
      out.push(dims.length ? '__arr([' + dims.join(', ') + '], () => ' + defaultValue(info) + ')' : defaultValue(info));
      if (isOp(m, ',')) { out.push(', '); return declarator(nx(m), info); }
      return pv(m);
    }

    function enumDecl(i) {
      // enum [class] Nom { A, B = 5, C };  →  const A = 0, B = 5, C = 6;
      let j = nx(i);
      if (V(j) === 'class') j = nx(j);
      if (T(j) === 'id') j = nx(j);
      if (!isOp(j, '{')) throw CppError('enum : « { » attendu', L(i));
      const c = match(j), items = [];
      let k = nx(j), next = '0';
      while (k < c) {
        if (T(k) !== 'id') throw CppError('enum : nom attendu', L(k));
        const name = V(k);
        let m = nx(k);
        if (isOp(m, '=')) { const e = exprEnd(nx(m)); next = raw(nx(m), e); m = e; }
        items.push(safe(name) + ' = ' + next);
        scopes[0][name] = { kind: 'int' };
        next = '(' + safe(name) + ') + 1';
        if (isOp(m, ',')) k = nx(m);
        else if (m === c) k = c;
        else throw CppError('enum : « , » attendue', L(m));
      }
      out.push(newlines(i, c) + (items.length ? 'const ' + items.join(', ') : ''));
      let e = nx(c);
      if (T(e) === 'id') e = nx(e);   // enum Nom { … } variable;  (variable non prise en charge)
      return isOp(e, ';') ? e : c;
    }

    // Traite le jeton i (et éventuellement les suivants) ; renvoie l'index du dernier jeton consommé
    function step(i) {
      const t = toks[i], v = t.v;
      const wasStmt = stmt;
      stmt = false;
      const wasAfterDo = afterDo;
      afterDo = false;

      if (t.t === 'id') {
        if (UNSUPPORTED_KW.has(v)) throw CppError('« ' + v + ' » n\'est pas pris en charge par le simulateur', t.line);
        if (UNSUPPORTED_TYPES.has(v)) throw CppError(v + ' n\'est pas pris en charge (WiFi simulé : WiFi et WiFiUDP)', t.line);
        if (v === 'enum') { stmt = true; return enumDecl(i); }
        if (wasStmt) {
          const info = declInfo(i);
          if (info) {
            const name = V(info.nameIdx), k = nx(info.nameIdx);
            if (isOp(k, '(')) {
              const c = match(k), nxt = nx(c);
              if (isOp(nxt, '{')) {
                if (braces.length) throw CppError('fonction « ' + name + ' » définie à l\'intérieur d\'un bloc', t.line);
                const p = params(k, c);
                out.push(newlines(i, c) + 'function* ' + safe(name) + '(' + p.text + ')');
                pendingScope = p.scope;
                pendingFnInt = info.kind === 'int';
                return c;
              }
              if (info.kind !== 'class' && info.kind !== 'String' && !braces.length) {
                out.push(newlines(i, nxt));   // prototype : inutile en JavaScript
                stmt = true;
                return isOp(nxt, ';') ? nxt : c;
              }
            }
            if (info.words.includes('static') && braces.length) return staticDecl(i, info);
            out.push(newlines(i, info.nameIdx) + (info.words.includes('const') || info.words.includes('constexpr') ? 'const ' : 'let '));
            return declarator(info.nameIdx, info);
          }
          // Affectation à une variable entière : x = expr  →  x = __i(expr)
          const kind = lookup(v);
          if (kind && kind.kind === 'int' && !isOp(pv(i), '.')) {
            let m = nx(i);
            while (isOp(m, '[')) m = nx(match(m));
            if (T(m) === 'op' && ['=', '+=', '-=', '*=', '/=', '%='].includes(V(m))) assignAt[m] = { lv: [i, m] };
          }
          // String modifiée sur place : s.trim();  →  s = s.trim();
          const dot = nx(i), meth = nx(dot);
          if (isOp(dot, '.') && IN_PLACE[V(meth)] && isOp(nx(meth), '(') && isOp(nx(match(nx(meth))), ';')) {
            out.push(ident(v) + ' = ' + ident(v));
            if (IN_PLACE[V(meth)] !== V(meth)) toks[meth] = Object.assign({}, toks[meth], { v: IN_PLACE[V(meth)] });
            return i;
          }
        }
        if (v === 'for' || v === 'while') {
          if (v === 'while' && wasAfterDo) pendingCtrl = true; else pendingLoop = v;
          out.push(v);
          return i;
        }
        if (v === 'if' || v === 'switch') { pendingCtrl = true; out.push(v); return i; }
        if (v === 'do') { const b = nx(i); if (isOp(b, '{')) { loopBrace[b] = true; doBrace[b] = true; } out.push(v); return i; }
        if (v === 'else') { out.push(v); stmt = true; return i; }
        if (v === 'return' && fnInt.length && fnInt[fnInt.length - 1] && !isOp(nx(i), ';')) {
          out.push('return __i(');
          addB(exprEnd(nx(i)), ')');
          return i;
        }
        if (v === 'NULL' || v === 'nullptr') { out.push('null'); return i; }
        if (v === 'sizeof') { out.push('__sizeof'); return i; }
        if (v === 'yield' && isOp(nx(i), '(')) {
          const c = match(nx(i));
          for (let k = nx(i); k <= c; k++) skip[k] = true;
          out.push('(yield 0)');
          return i;
        }
        if (v === 'length' && isOp(pv(i), '.') && isOp(nx(i), '(') && isOp(nx(nx(i)), ')')) {
          out.push('length');
          return nx(nx(i));
        }
        const member = isOp(pv(i), '.') || isOp(pv(i), '->');
        if (!member && (userFns.has(v) || GEN_BUILTINS.has(v)) && isOp(nx(i), '(')) {
          out.push('(yield* ' + ident(v));
          genParen[nx(i)] = true;
          return i;
        }
        out.push(member ? v : ident(v));
        return i;
      }

      if (t.t === 'chr') {
        let s;
        try { s = Function('"use strict"; return ' + v)(); } catch (e) { throw CppError('caractère invalide ' + v, t.line); }
        // 'x' passé directement à print / println : texte ; sinon code du caractère
        const p = pv(i), f = pv(p);
        const asText = isOp(p, '(') && ['print', 'println'].includes(V(f)) && isOp(nx(i), ')');
        out.push(asText ? JSON.stringify(s) : String(s.charCodeAt(0) || 0));
        return i;
      }
      if (t.t === 'str') {
        out.push(v);
        if (T(nx(i)) === 'str') out.push(' + ');   // "a" "b" : chaînes accolées
        return i;
      }
      if (t.t === 'num') { out.push(/^0[0-7]+$/.test(v) ? String(parseInt(v, 8)) : v); return i; }

      // ---- Opérateurs et ponctuation ----
      if (v === '{') {
        const p = pv(i);
        const init = isOp(p, '=') || (braces[braces.length - 1] === 'init' && (isOp(p, '{') || isOp(p, ',')));
        if (init) { braces.push('init'); out.push('['); return i; }
        if (pendingScope) {
          braces.push('func'); fnInt.push(pendingFnInt);
          scopes.push(pendingScope); pendingScope = null;
        } else {
          braces.push(doBrace[i] ? 'do' : 'block');
          scopes.push({});
        }
        out.push('{' + (loopBrace[i] ? ' if (__tick()) yield 0;' : ''));
        stmt = true;
        return i;
      }
      if (v === '}') {
        const k = braces.pop();
        if (k === undefined) throw CppError('« } » en trop', t.line);
        if (k === 'init') { out.push(']'); return i; }
        scopes.pop();
        if (k === 'func') fnInt.pop();
        if (k === 'do') afterDo = true;
        out.push('}');
        stmt = true;
        return i;
      }
      if (v === '(') {
        // Cast : (int) x, (float)(a + b)… — pas après un nom de fonction ni une parenthèse
        const p = pv(i);
        const castable = !genParen[i] && !isOp(p, ')') && !isOp(p, ']') && (T(p) !== 'id' || ['return', 'case', 'else', 'do'].includes(V(p)));
        let j = nx(i);
        const words = [];
        while (isTypeTok(j)) { words.push(V(j)); j = nx(j); }
        let ptr = false;
        while (isOp(j, '*')) { ptr = true; j = nx(j); }
        if (castable && words.length && isOp(j, ')') && !isOp(nx(j), ';') && !isOp(nx(j), ')') && !isOp(nx(j), ',')) {
          const { kind, base } = kindOf(words);
          const fn = ptr ? '' : kind === 'int' ? (base === 'char' ? '__chr' : '__i') : kind === 'bool' ? 'Boolean' : kind === 'String' ? 'String' : '';
          out.push(newlines(i, j) + fn + '(');
          addA(operandEnd(nx(j)), ')');
          return j;
        }
        const entry = { gen: !!genParen[i], loop: pendingLoop, ctrl: pendingCtrl };
        pendingLoop = null; pendingCtrl = false;
        parens.push(entry);
        out.push('(');
        if (entry.loop === 'for') stmt = true;
        return i;
      }
      if (v === ')') {
        const e = parens.pop() || {};
        out.push(e.gen ? '))' : ')');
        if (after[i]) { out.push(after[i]); delete after[i]; }
        if (e.loop) {
          const b = nx(i);
          if (isOp(b, '{')) loopBrace[b] = true;
          else if (isOp(b, ';')) { out.push(' { if (__tick()) yield 0; }'); skip[b] = true; }
          else { out.push(' { if (__tick()) yield 0; '); addA(stmtEnd(b), ' }'); }
        }
        if (e.loop || e.ctrl) stmt = true;
        return i;
      }
      if (v === ';') {
        out.push(';');
        const top = parens[parens.length - 1];
        stmt = !parens.length || (top && top.loop === 'for');
        return i;
      }
      if (v === ',' && declComma[i]) {
        out.push(', ');
        return declarator(nx(i), declComma[i]);
      }
      if (v === ':') { out.push(':'); stmt = !parens.length; return i; }
      if (v === '->' || v === '::') { out.push('.'); return i; }
      if (assignAt[i]) {
        const [a, b] = assignAt[i].lv, e = exprEnd(nx(i));
        out.push(v === '=' ? '= __i(' : '= __i(' + raw(a, b) + ' ' + v.slice(0, -1) + ' (');
        addB(e, v === '=' ? ')' : '))');
        return i;
      }
      out.push(v);
      return i;
    }

    for (let i = 0; i < n; i++) {
      if (before[i]) out.push(before[i]);
      let last = i;
      if (skip[i]) last = i;
      else if (toks[i].t === 'ws') out.push(toks[i].v);
      else last = step(i);
      for (let k = i; k <= last; k++) if (after[k]) out.push(after[k]);
      i = last;
    }
    if (braces.length) throw CppError('« { » jamais refermée', L(n - 1));
    return prelude + out.join('');
  }
  Ard.transpile = transpile;

  // ================= Bibliothèque Arduino (fonctions offertes au programme) =================

  const fmtNum = (v, f) => {
    if (f === undefined) return Number.isInteger(v) ? String(v) : v.toFixed(2);
    if (Number.isInteger(v) && [2, 8, 10, 16].includes(f)) return (v < 0 ? v >>> 0 : v).toString(f).toUpperCase();
    return v.toFixed(Math.max(0, Math.min(10, f | 0)));
  };
  function fmt(v, f) {
    if (Array.isArray(v)) {
      let s = '';
      for (const c of v) { if (!c) break; s += typeof c === 'number' ? String.fromCharCode(c) : String(c); }
      return s;
    }
    if (typeof v === 'number') return fmtNum(v, f);
    if (typeof v === 'boolean') return v ? '1' : '0';
    if (v === undefined || v === null) return '';
    return String(v);
  }
  // printf : %d %i %u %ld %lu %f %.2f %s %c %x %X %o %%, largeur et zéros (%04d)
  function cfmt(f, args) {
    let k = 0;
    return String(f).replace(/%([-0+ ]*)(\d*)(?:\.(\d+))?(?:hh|h|ll|l|z)?([diufFsScxXoe%])/g, (m, flags, width, prec, conv) => {
      if (conv === '%') return '%';
      let a = args[k++], s;
      switch (conv) {
        case 'd': case 'i': case 'u': s = String(Math.trunc(+a || 0)); break;
        case 'f': case 'F': s = (+a || 0).toFixed(prec === undefined ? 6 : +prec); break;
        case 'e': s = (+a || 0).toExponential(prec === undefined ? 6 : +prec); break;
        case 'x': s = ((+a || 0) >>> 0).toString(16); break;
        case 'X': s = ((+a || 0) >>> 0).toString(16).toUpperCase(); break;
        case 'o': s = ((+a || 0) >>> 0).toString(8); break;
        case 'c': s = typeof a === 'number' ? String.fromCharCode(a) : String(a); break;
        default: s = fmt(a); if (prec !== undefined) s = s.slice(0, +prec);
      }
      if (flags.includes('+') && /[dif]/.test(conv) && +a >= 0) s = '+' + s;
      if (width && s.length < +width) {
        if (flags.includes('-')) s = s.padEnd(+width);
        else if (flags.includes('0') && /[diufxXo]/.test(conv)) s = (s[0] === '-' ? '-' + s.slice(1).padStart(+width - 1, '0') : s.padStart(+width, '0'));
        else s = s.padStart(+width);
      }
      return s;
    });
  }

  // Méthodes de String (Arduino) absentes des chaînes JavaScript
  const strMethods = {
    toInt() { return parseInt(this, 10) || 0; },
    toFloat() { return parseFloat(this) || 0; },
    toDouble() { return parseFloat(this) || 0; },
    equals(s) { return String(this) === String(s); },
    equalsIgnoreCase(s) { return String(this).toLowerCase() === String(s).toLowerCase(); },
    c_str() { return String(this); },
    compareTo(s) { return String(this) < String(s) ? -1 : String(this) > String(s) ? 1 : 0; },
    isEmpty() { return this.length === 0; }
  };
  Object.keys(strMethods).forEach(k => {
    if (!(k in String.prototype)) Object.defineProperty(String.prototype, k, { value: strMethods[k], configurable: true, writable: true });
  });

  function IPAddress(a, b, c, d) {
    if (!(this instanceof IPAddress)) return new IPAddress(a, b, c, d);
    let p;
    if (a instanceof IPAddress) p = a.p.slice();
    else if (typeof a === 'string') p = a.split('.').map(x => +x || 0);
    else if (b === undefined && typeof a === 'number') p = [a & 255, (a >>> 8) & 255, (a >>> 16) & 255, (a >>> 24) & 255];
    else p = [a, b, c, d].map(x => (+x || 0) & 255);
    while (p.length < 4) p.push(0);
    this.p = p.slice(0, 4);
    this.p.forEach((x, i) => { this[i] = x; });
  }
  IPAddress.prototype.toString = function () { return this.p.join('.'); };
  IPAddress.prototype.fromString = function (s) { IPAddress.call(this, String(s)); return true; };

  const WL = { WL_IDLE_STATUS: 0, WL_NO_SSID_AVAIL: 1, WL_SCAN_COMPLETED: 2, WL_CONNECTED: 3, WL_CONNECT_FAILED: 4, WL_CONNECTION_LOST: 5, WL_DISCONNECTED: 6 };

  // Générateur pseudo-aléatoire reproductible (randomSeed)
  function prng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ================= Exécution d'une carte =================

  const runtimes = {};          // clé composant -> Runtime
  let live = [];                // cartes du projet, dans l'ordre (réseau WiFi)

  function Runtime(it, code) {
    this.key = it.key;
    this.boardId = it.board.id;
    this.compId = it.comp.id;
    this.code = code;
    this.pins = {};             // gpio -> { mode: 'out' | 'in' | 'pullup' | 'pulldown', v }
    this.serial = '';
    this.rx = '';
    this.now = 0;
    this.wake = 0;
    this.ops = 0;
    this.error = null;
    this.done = false;
    this.wifi = null;           // { ssid, pass, ap, at }
    this.ip = null;
    this.staticIp = null;
    this.sockets = [];
    this.ledc = {};
    this.rand = prng(1);
    this.out = { '3V3': VCC, GND: 0 };
    try {
      const js = transpile(code);
      const api = this.api();
      const names = Object.keys(api);
      const factory = new Function(names.join(','), 'return function* () {\n' + js +
        '\nreturn { setup: typeof setup === "function" ? setup : null, loop: typeof loop === "function" ? loop : null };\n};');
      this.js = js;
      this.gen = this.driver(factory.apply(null, names.map(k => api[k])));
    } catch (e) {
      this.fail(e, true);
    }
  }
  Ard.Runtime = Runtime;

  Runtime.prototype.fail = function (e, compile) {
    let msg = e && e.message ? e.message : String(e);
    if (!e.cppLine && e.stack) {
      // ligne dans le code généré (2 lignes d'en-tête de new Function + 1 ligne d'enveloppe)
      const m = /<anonymous>:(\d+):\d+/.exec(e.stack);
      if (m && +m[1] > 3) msg += ' (ligne ' + (+m[1] - 3) + ')';
    }
    this.error = (compile ? 'compilation : ' : 'exécution : ') + msg;
    this.write('\n[' + this.error + ']\n');
  };

  Runtime.prototype.driver = function* (main) {
    const m = yield* main();
    if (!m.setup && !m.loop) throw new Error('il manque les fonctions setup() et loop()');
    if (m.setup) yield* m.setup();
    if (!m.loop) return;
    for (;;) {
      yield* m.loop();
      if (++this.ops > OPS_LIMIT) yield 0;
    }
  };

  // Fait avancer le programme jusqu'au temps t (s)
  Runtime.prototype.run = function (t) {
    if (this.error || this.done || !this.gen) return;
    this.ops = 0;
    let guard = 0;
    while (this.wake <= t) {
      if (++guard > 5000) { this.now = t; return; }
      if (this.wake > this.now) this.now = this.wake;
      let r;
      try { r = this.gen.next(); } catch (e) { this.fail(e); return; }
      if (r.done) { this.done = true; return; }
      const d = +r.value || 0;
      if (d > 0) this.wake = this.now + d;
      else { this.now = Math.max(this.now, t); this.wake = t + 1e-9; return; }
    }
  };

  Runtime.prototype.write = function (s) {
    this.serial += s;
    if (this.serial.length > SERIAL_MAX) this.serial = this.serial.slice(-SERIAL_MAX * 0.8);
  };

  Runtime.prototype.gpio = function (p, forOutput) {
    p = +p;
    if (!GPIO.includes(p)) throw new Error('la broche ' + p + ' n\'existe pas sur l\'ESP32');
    if (forOutput && INPUT_ONLY.includes(p)) throw new Error('GPIO' + p + ' est une entrée seule (34 à 39)');
    return this.pins[p] || (this.pins[p] = { mode: 'in', v: 0 });
  };
  Runtime.prototype.setOut = function (p, v) {
    const s = this.gpio(p, true);
    s.mode = 'out';
    s.v = Math.max(0, Math.min(VCC, v));
    this.refreshOut();
  };
  Runtime.prototype.refreshOut = function () {
    const out = { '3V3': VCC, GND: 0 };
    Object.keys(this.pins).forEach(k => { if (this.pins[k].mode === 'out') out['D' + k] = this.pins[k].v; });
    this.out = out;
  };
  Runtime.prototype.volts = function (p) {
    const s = this.gpio(p);
    if (s.mode === 'out') return s.v;
    const v = App.Sim.valueAt(this.boardId, this.compId, 'D' + p);
    if (v === null) return s.mode === 'pullup' ? VCC : 0;
    return v;
  };

  // ---- WiFi ----
  Runtime.prototype.netPeers = function () {
    const ssid = this.wifi && this.wifi.ssid;
    return live.map(it => it.rt).filter(r => r && r !== this && r.wifi && r.wifi.ssid === ssid);
  };
  Runtime.prototype.wifiStatus = function () {
    const w = this.wifi;
    if (!w) return WL.WL_DISCONNECTED;
    if (w.ap) return WL.WL_CONNECTED;
    if (this.now < w.at) return WL.WL_DISCONNECTED;
    // le mot de passe du réseau est celui du point d'accès, sinon de la première carte du réseau
    const peers = this.netPeers();
    const ap = peers.find(r => r.wifi.ap);
    const ref = ap || live.map(it => it.rt).find(r => r && r.wifi && r.wifi.ssid === w.ssid);
    if (ref && ref !== this && ref.wifi.pass !== w.pass) return WL.WL_CONNECT_FAILED;
    if (!this.ip) {
      if (this.staticIp) this.ip = this.staticIp;
      else {
        const base = ap ? '192.168.4.' : '192.168.1.';
        const used = new Set(peers.map(r => r.ip));
        let k = ap ? 2 : 100;
        while (used.has(base + k)) k++;
        this.ip = base + k;
      }
    }
    return WL.WL_CONNECTED;
  };
  Runtime.prototype.connected = function () { return this.wifiStatus() === WL.WL_CONNECTED; };
  Runtime.prototype.sendUdp = function (host, port, fromPort, data) {
    if (!this.connected()) return false;
    host = String(host);
    const broadcast = /\.255$/.test(host);
    const targets = (host === this.ip ? [this] : []).concat(this.netPeers().filter(r => r.connected() && (broadcast || r.ip === host)));
    targets.forEach(r => r.sockets.forEach(s => {
      if (s.port === +port && s.q.length < 64) s.q.push({ data, pos: 0, from: this.ip, fromPort });
    }));
    this.txAt = this.now;
    return targets.length > 0 || broadcast;
  };

  Runtime.prototype.api = function () {
    const rt = this;
    const num = x => +x || 0;
    const api = {
      HIGH: 1, LOW: 0, INPUT: 0x01, OUTPUT: 0x03, INPUT_PULLUP: 0x05, INPUT_PULLDOWN: 0x09,
      LED_BUILTIN: 2,
      A0: 36, A3: 39, A4: 32, A5: 33, A6: 34, A7: 35, A10: 4, A11: 0, A12: 2, A13: 15, A14: 13, A15: 12,
      A16: 14, A17: 27, A18: 25, A19: 26, DAC1: 25, DAC2: 26,
      DEC: 10, HEX: 16, OCT: 8, BIN: 2,
      PI: Math.PI, HALF_PI: Math.PI / 2, TWO_PI: Math.PI * 2, DEG_TO_RAD: Math.PI / 180, RAD_TO_DEG: 180 / Math.PI,
      WIFI_STA: 1, WIFI_AP: 2, WIFI_AP_STA: 3, WIFI_OFF: 0,

      pinMode(p, mode) {
        const s = rt.gpio(p, mode === 0x03);
        if (mode === 0x03) rt.setOut(p, s.mode === 'out' ? s.v : 0);
        else {
          s.mode = mode === 0x05 ? 'pullup' : mode === 0x09 ? 'pulldown' : 'in';
          rt.refreshOut();
        }
      },
      digitalWrite(p, v) { const s = rt.gpio(p); if (s.mode === 'out') rt.setOut(p, v ? VCC : 0); },
      digitalRead(p) { return rt.volts(p) >= VCC / 2 ? 1 : 0; },
      analogRead(p) { return Math.round(Math.max(0, Math.min(1, rt.volts(p) / VCC)) * 4095); },
      analogReadMilliVolts(p) { return Math.round(Math.max(0, Math.min(VCC, rt.volts(p))) * 1000); },
      analogWrite(p, v) { rt.setOut(p, VCC * Math.max(0, Math.min(255, num(v))) / 255); },
      dacWrite(p, v) { rt.setOut(p, VCC * Math.max(0, Math.min(255, num(v))) / 255); },
      analogReadResolution() {},
      analogWriteResolution() {},
      ledcAttach(p, freq, bits) { rt.gpio(p, true); rt.ledc[+p] = num(bits) || 8; return true; },
      ledcWrite(p, duty) { const max = Math.pow(2, rt.ledc[+p] || 8) - 1; rt.setOut(p, VCC * Math.max(0, Math.min(max, num(duty))) / max); return true; },
      tone() {}, noTone() {},

      millis() { return Math.floor(rt.now * 1000); },
      micros() { return Math.floor(rt.now * 1e6); },
      delay: function* (ms) { yield Math.max(0, num(ms)) / 1000; },
      delayMicroseconds: function* (us) { yield Math.max(0, num(us)) / 1e6; },

      abs: Math.abs, fabs: Math.abs, sqrt: Math.sqrt, pow: Math.pow, sin: Math.sin, cos: Math.cos, tan: Math.tan,
      asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2, exp: Math.exp, log: Math.log, log10: Math.log10,
      floor: Math.floor, ceil: Math.ceil, round: Math.round, fmod: (a, b) => a % b,
      min: Math.min, max: Math.max,
      sq: x => x * x,
      constrain: (x, a, b) => Math.min(b, Math.max(a, x)),
      map: (x, a, b, c, d) => Math.trunc((x - a) * (d - c) / (b - a) + c),
      radians: d => d * Math.PI / 180, degrees: r => r * 180 / Math.PI,
      random(a, b) { if (b === undefined) { b = a; a = 0; } return Math.floor(a + rt.rand() * (b - a)); },
      randomSeed(s) { rt.rand = prng(num(s)); },
      bitRead: (x, n) => (x >> n) & 1, bit: n => 1 << n, lowByte: x => x & 255, highByte: x => (x >> 8) & 255,
      isDigit: c => c >= 48 && c <= 57, isAlpha: c => /[a-z]/i.test(String.fromCharCode(c)), isSpace: c => /\s/.test(String.fromCharCode(c)),
      F: s => s,
      String(v, f) { return v === undefined ? '' : fmt(v, f); },
      IPAddress,

      __i: x => (typeof x === 'number' ? Math.trunc(x) : typeof x === 'boolean' ? +x : typeof x === 'string' && x.length === 1 ? x.charCodeAt(0) : Math.trunc(+x || 0)),
      __chr: x => String.fromCharCode(num(x)),
      __sizeof: x => (Array.isArray(x) ? x.length : typeof x === 'string' ? x.length + 1 : 1),
      __arr(dims, make) {
        const build = (k) => Array.from({ length: Math.max(0, num(dims[k])) }, () => (k + 1 < dims.length ? build(k + 1) : make()));
        return build(0);
      },
      __tick: () => ++rt.ops > OPS_LIMIT,

      Serial: {
        begin() {}, end() {}, flush() {}, setTimeout() {},
        print(v, f) { rt.write(fmt(v, f)); },
        println(v, f) { rt.write((v === undefined ? '' : fmt(v, f)) + '\n'); },
        printf(f, ...a) { rt.write(cfmt(f, a)); },
        write(c) { rt.write(typeof c === 'number' ? String.fromCharCode(c) : fmt(c)); },
        available() { return rt.rx.length; },
        read() { if (!rt.rx.length) return -1; const c = rt.rx.charCodeAt(0); rt.rx = rt.rx.slice(1); return c; },
        peek() { return rt.rx.length ? rt.rx.charCodeAt(0) : -1; },
        readString() { const s = rt.rx; rt.rx = ''; return s; },
        readStringUntil(ch) {
          ch = typeof ch === 'number' ? String.fromCharCode(ch) : String(ch);
          const k = rt.rx.indexOf(ch);
          const s = k < 0 ? rt.rx : rt.rx.slice(0, k);
          rt.rx = k < 0 ? '' : rt.rx.slice(k + 1);
          return s;
        },
        parseInt() { const m = /-?\d+/.exec(rt.rx); if (!m) return 0; rt.rx = rt.rx.slice(m.index + m[0].length); return +m[0]; },
        parseFloat() { const m = /-?\d+(\.\d+)?/.exec(rt.rx); if (!m) return 0; rt.rx = rt.rx.slice(m.index + m[0].length); return +m[0]; }
      },

      WiFi: {
        mode() { return true; }, setHostname() { return true; }, persistent() {}, setSleep() {}, setAutoReconnect() {},
        begin(ssid, pass) {
          rt.wifi = { ssid: String(ssid), pass: pass == null ? '' : String(pass), ap: false, at: rt.now + 0.5 };
          rt.ip = null;
          return WL.WL_DISCONNECTED;
        },
        softAP(ssid, pass) {
          rt.wifi = { ssid: String(ssid), pass: pass == null ? '' : String(pass), ap: true, at: rt.now };
          rt.ip = '192.168.4.1';
          return true;
        },
        config(ip) { rt.staticIp = String(ip); if (rt.ip) rt.ip = rt.staticIp; return true; },
        status() { return rt.wifiStatus(); },
        isConnected() { return rt.connected(); },
        disconnect() { rt.wifi = null; rt.ip = null; return true; },
        reconnect() { if (rt.wifi) rt.wifi.at = rt.now + 0.5; rt.ip = null; return true; },
        localIP() { return IPAddress(rt.connected() && !(rt.wifi && rt.wifi.ap) ? rt.ip : '0.0.0.0'); },
        softAPIP() { return IPAddress(rt.wifi && rt.wifi.ap ? rt.ip : '0.0.0.0'); },
        gatewayIP() { return IPAddress(rt.ip ? rt.ip.replace(/\d+$/, '1') : '0.0.0.0'); },
        subnetMask() { return IPAddress('255.255.255.0'); },
        broadcastIP() { return IPAddress(rt.ip ? rt.ip.replace(/\d+$/, '255') : '255.255.255.255'); },
        SSID(i) {
          if (i !== undefined) return (Ard.ssids()[i] || '');
          return rt.wifi ? rt.wifi.ssid : '';
        },
        RSSI() { return rt.connected() ? -42 - (live.findIndex(it => it.rt === rt) % 5) * 6 : 0; },
        macAddress() {
          let h = 0;
          for (const ch of rt.key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
          return ['24', '6F', '28', (h >>> 16 & 255), (h >>> 8 & 255), (h & 255)].map(x => (typeof x === 'number' ? x.toString(16).padStart(2, '0') : x).toUpperCase()).join(':');
        },
        scanNetworks() { return Ard.ssids().length; },
        softAPgetStationNum() { return rt.wifi && rt.wifi.ap ? rt.netPeers().filter(r => r.connected()).length : 0; }
      },

      WiFiUDP: function WiFiUDP() {
        this.port = 0; this.q = []; this.cur = null; this.pkt = null;
        rt.sockets.push(this);
      },
      ...WL
    };
    const U = api.WiFiUDP.prototype;
    U.begin = function (port) { this.port = +port; return 1; };
    U.stop = function () { this.port = 0; this.q = []; this.cur = null; };
    U.beginPacket = function (host, port) { this.pkt = { host: String(host), port: +port, data: '' }; return 1; };
    U.print = function (v, f) { if (this.pkt) this.pkt.data += fmt(v, f); return 1; };
    U.println = function (v, f) { if (this.pkt) this.pkt.data += (v === undefined ? '' : fmt(v, f)) + '\n'; return 1; };
    U.printf = function (f, ...a) { if (this.pkt) this.pkt.data += cfmt(f, a); return 1; };
    U.write = function (c, len) {
      if (!this.pkt) return 0;
      if (Array.isArray(c)) { this.pkt.data += fmt(len === undefined ? c : c.slice(0, len)); return 1; }
      this.pkt.data += typeof c === 'number' ? String.fromCharCode(c) : String(c);
      return 1;
    };
    U.endPacket = function () {
      if (!this.pkt) return 0;
      const p = this.pkt;
      this.pkt = null;
      return rt.sendUdp(p.host, p.port, this.port, p.data) ? 1 : 0;
    };
    U.parsePacket = function () { this.cur = this.q.shift() || null; return this.cur ? this.cur.data.length : 0; };
    U.available = function () { return this.cur ? this.cur.data.length - this.cur.pos : 0; };
    U.read = function (buf, len) {
      const c = this.cur;
      if (!c || c.pos >= c.data.length) return buf === undefined ? -1 : 0;
      if (buf === undefined) return c.data.charCodeAt(c.pos++);
      let k = 0;
      while (k < len && c.pos < c.data.length) buf[k++] = c.data.charCodeAt(c.pos++);
      if (Array.isArray(buf) && k < buf.length) buf[k] = 0;
      return k;
    };
    U.peek = function () { const c = this.cur; return c && c.pos < c.data.length ? c.data.charCodeAt(c.pos) : -1; };
    U.readString = function () { const c = this.cur; if (!c) return ''; const s = c.data.slice(c.pos); c.pos = c.data.length; return s; };
    U.readStringUntil = function (ch) {
      const c = this.cur; if (!c) return '';
      ch = typeof ch === 'number' ? String.fromCharCode(ch) : String(ch);
      const k = c.data.indexOf(ch, c.pos);
      const s = c.data.slice(c.pos, k < 0 ? c.data.length : k);
      c.pos = k < 0 ? c.data.length : k + 1;
      return s;
    };
    U.remoteIP = function () { return IPAddress(this.cur ? this.cur.from : '0.0.0.0'); };
    U.remotePort = function () { return this.cur ? this.cur.fromPort : 0; };
    U.flush = function () {};
    return api;
  };

  // Texte affiché sur la carte (schéma, 3D, panneau)
  Runtime.prototype.label = function () {
    if (this.error) return 'erreur';
    if (!this.wifi) return 'WiFi —';
    const st = this.wifiStatus();
    if (st === WL.WL_CONNECTED) return (this.wifi.ap ? 'AP ' : 'WiFi ') + this.ip;
    return st === WL.WL_CONNECT_FAILED ? 'WiFi refusé' : 'WiFi…';
  };

  // ================= Liaison avec le simulateur =================

  Ard.codeOf = (comp, def) => (typeof comp.code === 'string' ? comp.code : def.code || '');

  // Appelé par Sim.rebuild pour chaque carte : garde le programme en cours s'il n'a pas changé
  Ard.attach = function (it) {
    const code = Ard.codeOf(it.comp, it.def);
    let rt = runtimes[it.key];
    if (!rt || rt.code !== code) rt = runtimes[it.key] = new Runtime(it, code);
    it.rt = rt;
    it.fn = function (inp, props, state) {
      state.text = rt.label();
      const led = rt.pins[2];
      state.light = led && led.mode === 'out' && led.v > 0 ? led.v / VCC : 0;
      if (rt.error) throw new Error(rt.error);
      return rt.out;
    };
  };
  Ard.sync = function (items) {
    live = items.filter(it => it.rt);
    const keep = new Set(live.map(it => it.key));
    Object.keys(runtimes).forEach(k => { if (!keep.has(k)) delete runtimes[k]; });
    return live;
  };
  Ard.reset = function () { Object.keys(runtimes).forEach(k => delete runtimes[k]); live = []; };
  Ard.runtime = key => runtimes[key] || null;
  Ard.ssids = () => [...new Set(live.map(it => it.rt.wifi && it.rt.wifi.ssid).filter(Boolean))];
  // Réseaux WiFi en cours : ssid -> [clé des cartes connectées]
  Ard.networks = function () {
    const map = {};
    live.forEach(it => {
      const r = it.rt;
      if (r.wifi && !r.error && r.ip && r.wifiStatus() === WL.WL_CONNECTED) (map[r.wifi.ssid] = map[r.wifi.ssid] || []).push(it.key);
    });
    return map;
  };

  // Vérifie un programme sans l'exécuter : null si correct, sinon le message d'erreur
  Ard.check = function (code) {
    try {
      const js = transpile(code);
      const names = Object.keys(Runtime.prototype.api.call({ rand: Math.random }));
      new Function(names.join(','), 'return function* () {\n' + js + '\n};');
      return null;
    } catch (e) {
      return e.message;
    }
  };
})();
