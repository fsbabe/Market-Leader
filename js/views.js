/* Vistas: cuadro de mando, tareas y cuentas. */
(function(){
  'use strict';
  var ML = window.ML, esc = ML.esc;
  ML.ui = { tab: 'dashboard', kpiDays: 90, quick: 'abiertas', f: { account: [], owner: [], vp: [], pilar: [], status: [], q: '' }, msOpen: null, group: '', sort: 'due', dir: 1, openNote: null, openAcc: null, collapsed: {}, addSub: null };
  var $ = function(id){ return document.getElementById(id); };

  function opts(list, sel, blank){
    var h = blank != null ? '<option value="">' + esc(blank) + '</option>' : '';
    var found = false;
    list.forEach(function(o){ var k = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; if(k === sel) found = true; h += '<option value="' + esc(k) + '"' + (k === sel ? ' selected' : '') + '>' + esc(l) + '</option>'; });
    if(sel && !found && list._kind) h += '<option value="' + esc(sel) + '" selected>' + esc(ML.lab(list, sel)) + ' (inactivo)</option>';
    return h;
  }
  function accOpts(sel, blank){ return opts(ML.s.accounts.filter(function(a){ return a.active || a.id === sel; }).map(function(a){ return [a.id, a.name]; }), sel, blank); }
  function peopleOpts(sel, blank){ return opts(ML.s.people.filter(function(p){ return p.active || p.name === sel; }).map(function(p){ return [p.name, p.name]; }), sel, blank); }
  function vpOpts(sel, blank){ return opts(ML.VPS.map(function(v){ return [v.k, v.label]; }), sel, blank); }
  function stStyle(k, extra){ var c = ML.stageColor(k); return c ? ' style="background:' + c + (extra || '') + '"' : (extra ? ' style="' + extra.replace(/^;/, '') + '"' : ''); }
  // ---- Columnas redimensionables (anchos en %, recordados en el navegador) ----
  var TASK_COLS = [3, 25, 11, 9, 7, 10, 11, 9, 7, 8];
  function accCols(){ var n = ML.VPS.length, rest = 62, each = Math.floor(rest / n * 100) / 100, a = [14, 12]; for(var i = 0; i < n; i++) a.push(each); a.push(8, 4); var s = a.reduce(function(x, y){ return x + y; }, 0); a[2] = Math.round((a[2] + 100 - s) * 100) / 100; return a; }
  function loadW(key, def){ try{ var a = JSON.parse(localStorage.getItem('ml_cols_' + key)); if(Array.isArray(a) && a.length === def.length && Math.abs(a.reduce(function(x, y){ return x + y; }, 0) - 100) < 1) return a; }catch(e){} return def; }
  function colgroup(key, def){ return '<colgroup>' + loadW(key, def).map(function(w){ return '<col style="width:' + w + '%">'; }).join('') + '</colgroup>'; }
  function makeResizable(table){
    var key = table.dataset.cols, cols = table.querySelectorAll('colgroup col'), ths = table.querySelectorAll('thead th');
    ths.forEach(function(th, i){
      if(i >= ths.length - 1) return;
      var h = document.createElement('span'); h.className = 'rz'; h.title = 'Arrastra para cambiar el ancho · doble clic: restablecer'; th.appendChild(h);
      h.addEventListener('click', function(e){ e.stopPropagation(); });
      h.addEventListener('dblclick', function(e){ e.stopPropagation(); try{ localStorage.removeItem('ml_cols_' + key); }catch(x){} ML.rerender(); });
      h.addEventListener('pointerdown', function(e){
        e.preventDefault(); e.stopPropagation(); h.setPointerCapture(e.pointerId); h.classList.add('on');
        var tw = table.getBoundingClientRect().width, x0 = e.clientX, a0 = parseFloat(cols[i].style.width), b0 = parseFloat(cols[i + 1].style.width), MIN = 4;
        function mv(ev){ var d = (ev.clientX - x0) / tw * 100, a = a0 + d, b = b0 - d; if(a < MIN){ b -= MIN - a; a = MIN; } if(b < MIN){ a -= MIN - b; b = MIN; } cols[i].style.width = a + '%'; cols[i + 1].style.width = b + '%'; }
        function up(){ h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.classList.remove('on');
          try{ localStorage.setItem('ml_cols_' + key, JSON.stringify(Array.prototype.map.call(cols, function(c){ return Math.round(parseFloat(c.style.width) * 100) / 100; }))); }catch(x){} }
        h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up);
      });
    });
  }
  function accName(id){ var a = ML.account(id); return a ? a.name : ''; }
  // Desplegable de selección múltiple (casillas). Vacío = todos.
  function ms(key, all, items){
    var sel = ML.ui.f[key], open = ML.ui.msOpen === key, label;
    if(!sel.length) label = all;
    else if(sel.length === 1){ var it = items.filter(function(i){ return i[0] === sel[0]; })[0]; label = it ? it[1] : sel[0]; }
    else label = sel.length + ' seleccionados';
    return '<div class="ms' + (sel.length ? ' on' : '') + '"><button type="button" class="msb" data-msb="' + key + '">' + esc(label) + ' ▾</button>' +
      (open ? '<div class="msp">' + items.map(function(i){ return '<label><input type="checkbox" data-msk="' + key + '" value="' + esc(i[0]) + '"' + (sel.indexOf(i[0]) >= 0 ? ' checked' : '') + '> ' + esc(i[1]) + '</label>'; }).join('') + '</div>' : '') + '</div>';
  }
  function openTasks(){ return ML.s.tasks.filter(ML.isOpen); }
  function openLeaves(){ return ML.leaves().filter(ML.isOpen); }   // lo que realmente hay que hacer

  // Contadores de cabecera (recordatorios en la app)
  ML.counters = function(){
    var o = openLeaves(), over = 0, soon = 0;
    o.forEach(function(t){ var u = ML.urgency(t); if(u === 'over') over++; else if(u === 'soon') soon++; });
    var co = $('chip-over'), cs = $('chip-soon');
    co.hidden = !over; co.textContent = over + ' vencida' + (over === 1 ? '' : 's');
    cs.hidden = !soon; cs.textContent = soon + ' en ≤3 días';
    var nt = ML.topTasks().filter(ML.isOpen).length; $('b-open').textContent = nt ? '(' + nt + ')' : '';
  };

  // ======================= CUADRO DE MANDO =======================
  function dashboard(){
    var o = openLeaves(), t = ML.today();
    var cnt = { over: 0, soon: 0, week: 0, none: 0, noOwner: 0 };
    o.forEach(function(x){ var u = ML.urgency(x); if(cnt[u] != null) cnt[u]++; if(!x.owner) cnt.noOwner++; });
    var d30 = ML.leaves().filter(function(x){ return x.status === 'hecha' && x.done_at && (Date.now() - new Date(x.done_at).getTime()) < 30 * 864e5; }).length;
    var kp = function(cls, n, label, quick){ return '<div class="kpi ' + cls + '" data-quick="' + quick + '"><b>' + n + '</b><span>' + label + '</span></div>'; };
    var h = '<div class="grid kpis">' + kp('over', cnt.over, 'Vencidas', 'vencidas') + kp('soon', cnt.soon, 'En 0–3 días', 'semana') + kp('week', cnt.week, 'En 4–7 días', 'semana') +
      kp('', cnt.none, 'Sin fecha', 'sinfecha') + kp('', cnt.noOwner, 'Sin responsable', 'abiertas') + kp('ok', d30, 'Hechas (30 días)', 'hechas') + '</div>';

    // Carga por responsable
    var by = {};
    o.forEach(function(x){ var k = x.owner || '(sin responsable)'; (by[k] = by[k] || { over: 0, soon: 0, week: 0, later: 0, none: 0, n: 0 }); by[k][ML.urgency(x)]++; by[k].n++; });
    var names = Object.keys(by).sort(function(a, b){ return by[b].n - by[a].n; });
    var max = names.length ? by[names[0]].n : 1;
    var load = names.map(function(n){
      var b = by[n], seg = function(k){ return b[k] ? '<i class="seg-' + k + '" data-seg="' + k + '" style="width:' + (b[k] / max * 100) + '%" title="' + esc(n) + ': ' + b[k] + '"></i>' : ''; };
      return '<div class="bar-row link" data-own="' + esc(n === '(sin responsable)' ? '__none' : n) + '"><span class="nm" title="' + esc(n) + '">' + esc(n) + '</span><div class="bar">' + seg('over') + seg('soon') + seg('week') + seg('later') + seg('none') + '</div><b>' + b.n + '</b></div>';
    }).join('') || '<p class="empty">Sin tareas abiertas</p>';
    var legend = '<div class="legend"><span><i class="seg-over"></i>Vencida</span><span><i class="seg-soon"></i>≤3 días</span><span><i class="seg-week"></i>≤7 días</span><span><i class="seg-later"></i>Más adelante</span><span><i class="seg-none"></i>Sin fecha</span></div>';

    // Embudo por VP
    var funnel = ML.VPS.map(function(v){
      var st = ML.s.stages.filter(function(s){ return s.vp === v.k && s.stage !== 'no_aplica'; });
      if(!st.length) return '';
      var c = {}; st.forEach(function(s){ c[s.stage] = (c[s.stage] || 0) + 1; });
      var tot = st.length;
      var segs = ML.STAGES.filter(function(s){ return c[s[0]]; }).map(function(s){ return '<i class="st-' + s[0] + '" data-vp="' + v.k + '" data-st="' + s[0] + '" style="' + (ML.stageColor(s[0]) ? 'background:' + ML.stageColor(s[0]) + ';' : '') + 'width:' + (c[s[0]] / tot * 100) + '%" title="' + esc(s[1]) + ': ' + c[s[0]] + '"></i>'; }).join('');
      return '<div class="bar-row link" data-vp="' + v.k + '"><span class="nm">' + esc(v.label) + '</span><div class="bar">' + segs + '</div><b>' + tot + '</b></div>';
    }).join('') || '<p class="empty">Sin cuentas</p>';
    var fl = '<div class="legend">' + ML.STAGES.filter(function(s){ return s[0] !== 'no_aplica'; }).map(function(s){ return '<span><i class="st-' + s[0] + '"' + stStyle(s[0]) + '></i>' + esc(s[1]) + '</span>'; }).join('') + '</div>';

    // Cuentas activas (Core o AI) sin ninguna tarea abierta
    var withTask = {}; ML.topTasks().filter(ML.isOpen).forEach(function(x){ if(x.account_id) withTask[x.account_id] = 1; });
    var idle = ML.s.accounts.filter(function(a){
      if(!a.active || withTask[a.id]) return false;
      return ML.s.stages.some(function(s){ return s.account_id === a.id && ML.ACTIVE_STAGES.indexOf(s.stage) >= 0 && s.stage !== 'sin_contacto' || (s.account_id === a.id && s.stage === 'sin_contacto' && (s.vp === 'ai')); });
    });
    var idleH = idle.length ? idle.slice(0, 12).map(function(a){ return '<div class="it"><span class="t">' + esc(a.name) + '</span><span class="m">' + esc(a.am || 'sin AM') + '</span></div>'; }).join('') + (idle.length > 12 ? '<p class="muted">… y ' + (idle.length - 12) + ' más</p>' : '') : '<p class="empty">Todas las cuentas activas tienen una acción abierta ✓</p>';

    // Próximas
    var next = o.filter(function(x){ var u = ML.urgency(x); return u === 'over' || u === 'soon' || u === 'week'; }).sort(function(a, b){ return a.due < b.due ? -1 : 1; });
    var nextH = next.slice(0, 15).map(function(x){
      var u = ML.urgency(x);
      var e = ML.eff(x), par = ML.parentOf(x);
      return '<div class="it"><span class="t"><span class="tid">' + ML.code(x) + '</span> ' + esc(x.title) + '<br><span class="m">' + esc([par ? 'Subtarea de «' + par.title + '»' : '', accName(e.account_id), e.vp ? ML.vpLabel(e.vp) : '', x.owner].filter(Boolean).join(' · ')) + '</span></span><span class="pill ' + u + '">' + ML.fmt(x.due) + ' · ' + ML.dueText(x) + '</span></div>';
    }).join('') + (next.length > 15 ? '<p class="muted">… y ' + (next.length - 15) + ' más (pestaña Tareas)</p>' : '') || '<p class="empty">Nada vence en los próximos 7 días</p>';

    return h + '<div class="grid cols">' +
      '<div class="panel"><h2>Vencen pronto</h2><div class="list">' + nextH + '</div></div>' +
      '<div class="panel"><h2>Carga por responsable (subtareas y tareas sin subtareas abiertas)</h2>' + load + legend + '</div>' +
      '<div class="panel"><h2>Embudo por propuesta de valor (cuentas)</h2>' + funnel + fl + '</div>' +
      '<div class="panel"><h2>Cuentas sin ninguna acción abierta</h2><div class="list">' + idleH + '</div></div></div>' + '<div class="grid" style="margin-top:14px">' + perAccountPanel() + '</div>';
  }

  function perAccountPanel(){
    var days = ML.ui.kpiDays, cutoff = days ? Date.now() - days * 864e5 : 0;
    var rows = ML.s.accounts.filter(function(a){ return a.active; }).map(function(a){
      var ts = ML.topTasks().filter(function(t){ return t.account_id === a.id && (!cutoff || !t.created_at || new Date(t.created_at).getTime() >= cutoff); });
      var done = ts.filter(function(t){ return t.status === 'hecha'; }).length, over = ts.filter(function(t){ return ML.urgency(t) === 'over'; }).length;
      var subs = 0, subsDone = 0; ts.forEach(function(t){ ML.childrenOf(t.id).forEach(function(k){ subs++; if(k.status === 'hecha') subsDone++; }); });
      return { a: a, n: ts.length, done: done, open: ts.length - done, over: over, subs: subs, subsDone: subsDone, pct: ts.length ? Math.round(done / ts.length * 100) : null, stage: ML.bestStage(a.id) };
    }).sort(function(x, y){ return (y.n - x.n) || x.a.name.localeCompare(y.a.name, 'es'); });
    var total = rows.reduce(function(m, r){ return m + r.n; }, 0), zero = rows.filter(function(r){ return !r.n; }).length;
    var max = rows.length ? Math.max(rows[0].n, 1) : 1;
    var avg = rows.length ? (total / rows.length).toFixed(1).replace('.', ',') : '0';
    var sel = '<select id="kpiDays">' + [[30, 'Últimos 30 días'], [90, 'Últimos 90 días'], [365, 'Últimos 12 meses'], [0, 'Todo el histórico']].map(function(o){ return '<option value="' + o[0] + '"' + (o[0] === days ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>';
    var body = rows.map(function(r){
      var st = r.stage ? '<span class="pill"' + (ML.stageColor(r.stage) ? ' style="border-color:' + ML.stageColor(r.stage) + '"' : '') + '>' + esc(ML.lab(ML.STAGES, r.stage)) + '</span>' : '<span class="muted">—</span>';
      return '<tr class="link" data-acc-go="' + esc(r.a.id) + '"><td><b>' + esc(r.a.name) + '</b></td><td class="muted">' + esc(r.a.am || '—') + '</td>' +
        '<td style="min-width:170px"><div class="bar"><i style="background:var(--ok);width:' + (r.done / max * 100) + '%"></i><i class="seg-later" style="width:' + (r.open / max * 100) + '%"></i></div></td>' +
        '<td><b>' + r.n + '</b></td><td>' + r.done + '</td><td>' + r.open + '</td><td class="muted">' + (r.subs ? r.subsDone + '/' + r.subs : '—') + '</td><td>' + (r.over ? '<span class="pill over">' + r.over + '</span>' : '0') + '</td><td>' + (r.pct == null ? '—' : r.pct + '%') + '</td><td>' + st + '</td></tr>';
    }).join('') || '<tr><td colspan="10" class="empty">Sin cuentas activas</td></tr>';
    return '<div class="panel wide"><div class="filters" style="margin-bottom:4px"><h2 style="margin:0">Tareas por cuenta</h2>' + sel +
      '<span class="muted">' + total + ' tareas creadas · media ' + avg + ' por cuenta · ' + zero + ' cuentas sin tareas</span></div>' +
      '<p class="muted" style="margin:0 0 8px;font-size:12px">Cuenta tareas (no subtareas) por fecha de creación. Mide actividad, no resultado: contrástala con la columna «Avance» (etapa más avanzada de la cuenta); las migradas o importadas comparten la fecha de carga.</p>' +
      '<div class="tablewrap" style="max-height:380px;overflow:auto"><table style="min-width:760px"><thead><tr><th>Cuenta</th><th>AM</th><th>Hechas / abiertas</th><th>Tareas</th><th>Hechas</th><th>Abiertas</th><th>Subtareas (hechas/total)</th><th>Vencidas</th><th>% cierre</th><th>Avance</th></tr></thead><tbody>' + body + '</tbody></table></div></div>';
  }

  // ======================= TAREAS (con subtareas) =======================
  var QUICK = [['abiertas', 'Abiertas'], ['vencidas', 'Vencidas'], ['semana', 'Próx. 7 días'], ['sinfecha', 'Sin fecha'], ['hechas', 'Hechas'], ['todas', 'Todas']];
  function passQuick(t, q){
    var u = ML.urgency(t);
    if(q === 'abiertas') return t.status !== 'hecha';
    if(q === 'vencidas') return u === 'over';
    if(q === 'semana') return u === 'soon' || u === 'week';
    if(q === 'sinfecha') return t.status !== 'hecha' && !t.due;
    if(q === 'hechas') return t.status === 'hecha';
    return true;
  }
  // Una fila (tarea o subtarea) pasa los filtros; cuenta, VP y pilar de una subtarea son los de su tarea
  function passRow(t){
    var f = ML.ui.f, q = f.q.trim().toLowerCase(), e = ML.eff(t);
    if(!passQuick(t, ML.ui.quick)) return false;
    if(f.account.length && f.account.indexOf(e.account_id) < 0) return false;
    if(f.owner.length && f.owner.indexOf(t.owner || '__none') < 0) return false;
    if(f.vp.length && f.vp.indexOf(e.vp) < 0) return false;
    if(f.pilar.length && f.pilar.indexOf(e.pilar) < 0) return false;
    if(f.status.length && f.status.indexOf(t.status) < 0) return false;
    if(q){
      var nq = q.replace(/^#/, ''), code = ML.code(t);
      var byCode = /^[\d-]+$/.test(nq) && (code === nq || code.replace(/(^|-)0+(?=\d)/g, '$1') === nq.replace(/(^|-)0+(?=\d)/g, '$1'));
      if(!byCode && (t.title + ' ' + accName(e.account_id) + ' ' + (t.owner || '') + ' ' + (t.note || '') + ' ' + (t.scope_text || '')).toLowerCase().indexOf(q) < 0) return false;
    }
    return true;
  }
  function cmpRows(a, b){
    var key = ML.ui.sort, dir = ML.ui.dir;
    var val = function(t){
      if(key === 'due') return t.due || (dir > 0 ? '9999' : '');
      if(key === 'account') return accName(ML.eff(t).account_id).toLowerCase() || '￿';
      if(key === 'priority') return { alta: 0, media: 1, baja: 2 }[t.priority];
      if(key === 'status') return ML.STATUS.map(function(s){ return s[0]; }).indexOf(t.status);
      return String(t[key] || '').toLowerCase() || '￿';
    };
    var x = val(a), y = val(b);
    return (x < y ? -1 : x > y ? 1 : 0) * dir || ((a.task_no || a.sub_no || a.id) - (b.task_no || b.sub_no || b.id));
  }
  // Árbol visible: una tarea se muestra si ella o alguna de sus subtareas pasa los filtros; debajo, las subtareas que pasan
  function tree(){
    var nodes = [];
    ML.topTasks().forEach(function(T){
      var all = ML.childrenOf(T.id), kids = all.filter(passRow), self = passRow(T);
      if(!self && !kids.length) return;
      kids.sort(cmpRows);
      nodes.push({ t: T, kids: kids, all: all, self: self });
    });
    nodes.sort(function(a, b){ return cmpRows(a.t, b.t); });
    return nodes;
  }
  function flat(nodes){ var r = []; nodes.forEach(function(n){ r.push(n.t); n.kids.forEach(function(k){ r.push(k); }); }); return r; }
  function groupKey(t){
    var g = ML.ui.group, e = ML.eff(t);
    if(g === 'owner') return t.owner || '(sin responsable)';
    if(g === 'account') return accName(e.account_id) || '(sin cuenta)';
    if(g === 'vp') return e.vp ? ML.vpLabel(e.vp) : '(sin VP)';
    return '';
  }
  function pill(kind, field, t){ return '<select class="cpill" data-f="' + field + '" style="' + ML.pillStyle(kind, t[field]) + '">' + opts(kind === 'status' ? ML.STATUS : ML.PRIOS, t[field]) + '</select>'; }
  function row(n, t){
    var sub = ML.isSub(t), u = ML.urgency(t), e = ML.eff(t), code = ML.code(t), r;
    var kids = sub ? [] : n.all, kidsDone = kids.filter(function(k){ return k.status === 'hecha'; }).length, collapsed = !!ML.ui.collapsed[t.id];
    var tag = '<span class="tid" title="' + (sub ? 'Código de la subtarea (tarea-subtarea)' : 'Código de la tarea') + '">' + code + '</span>';
    if(!sub){ var pc = ML.pilarColor(t.pilar); tag += ' <select class="ptag" data-f="pilar" title="Pilar (clic para cambiar)" style="background:' + pc + ';color:' + ML.textOn(pc) + '">' + opts(ML.PILARES, t.pilar) + '</select>'; }
    if(kids.length) tag = '<button class="tg" data-a="toggle" title="Mostrar / ocultar subtareas">' + (collapsed ? '▸' : '▾') + '</button> ' + tag + ' <span class="prog" title="Subtareas hechas / total">' + kidsDone + '/' + kids.length + '</span>';
    var par = sub ? ML.parentOf(t) : null, late = sub && par && par.due && t.due && t.due > par.due && t.status !== 'hecha';
    var actions = sub
      ? '<button class="btn sm" data-a="move" title="Cambiar de tarea">⇄</button> <button class="btn sm" data-a="promote" title="Convertir en tarea">↱</button> '
      : (ML.hasHier ? '<button class="btn sm" data-a="addsub" title="Añadir subtarea">＋</button> <button class="btn sm" data-a="tosub" title="Convertir en subtarea de otra tarea">↳</button> ' : '');
    r = '<tr class="u-' + u + (sub ? ' sub' : '') + (kids.length && collapsed ? ' cmp' : '') + (n.self || sub ? '' : ' ctx') + '" data-id="' + t.id + '">' +
      '<td class="act editable"><input type="checkbox" data-f="done"' + (t.status === 'hecha' ? ' checked' : '') + ' title="Marcar hecha"></td>' +
      '<td class="editable"><div class="tagline">' + tag + '</div><input class="title" data-f="title" value="' + esc(t.title) + '"><textarea class="cm" data-f="note" rows="1" placeholder="Comentarios…">' + esc(t.note) + '</textarea></td>' +
      (sub ? '<td class="inh" title="Heredado de la tarea">' + esc(accName(e.account_id) || '—') + '</td><td class="inh">' + esc(e.vp ? ML.vpLabel(e.vp) : '—') + '</td>'
           : '<td class="editable"><select data-f="account_id">' + accOpts(t.account_id, '—') + '</select></td><td class="editable"><select data-f="vp">' + vpOpts(t.vp, '—') + '</select></td>') +
      (sub ? '<td class="editable"><select data-f="kind">' + opts(ML.KINDS, t.kind) + '</select></td>' : '<td class="inh">—</td>') +
      '<td class="editable"><select data-f="owner">' + peopleOpts(t.owner, '—') + '</select></td>' +
      '<td class="editable dt"><input type="date" data-f="due" value="' + esc(t.due || '') + '">' + (ML.dueText(t) ? '<br><span class="pill ' + u + '">' + esc(ML.dueText(t)) + '</span>' : '') +
        (late ? '<br><span class="pill soon" title="La fecha de la subtarea es posterior a la de su tarea (' + esc(ML.fmt(par.due)) + ')">⚠ tras la tarea</span>' : '') + '</td>' +
      '<td class="editable">' + pill('status', 'status', t) + '</td>' +
      '<td class="editable">' + pill('priority', 'priority', t) + '</td>' +
      '<td class="act editable">' + actions + '<button class="btn sm danger rd" data-a="del" title="Eliminar" aria-label="Eliminar">🗑</button></td></tr>';
    return r;
  }
  function addSubRow(T){
    return '<tr class="addsub" data-parent="' + T.id + '"><td></td><td colspan="9"><form class="filters" data-addsub="' + T.id + '" style="margin:2px 0 2px 22px">' +
      '<span class="muted">Nueva subtarea de <b>' + ML.code(T) + '</b>:</span><input name="title" placeholder="Título de la subtarea…" required style="min-width:240px;flex:1">' +
      '<select name="kind">' + opts(ML.KINDS, 'otro') + '</select><select name="owner">' + peopleOpts(T.owner, 'Responsable') + '</select><input type="date" name="due" title="Fecha">' +
      '<button class="btn sm primary" type="submit">Añadir subtarea</button><button class="btn sm" type="button" data-a="cancelsub">Cancelar</button></form></td></tr>';
  }
  function tasksView(){
    var f = ML.ui.f, nodes = tree(), nsub = nodes.reduce(function(m, n){ return m + n.kids.length; }, 0);
    var th = function(k, l){ return '<th class="s" data-sort="' + k + '">' + l + (ML.ui.sort === k ? (ML.ui.dir > 0 ? ' ▲' : ' ▼') : '') + '</th>'; };
    var warn = ML.hasHier ? '' : '<div class="panel" style="border-color:var(--over);margin-bottom:12px"><b>Subtareas desactivadas.</b> Ejecuta <code>supabase/migration_v4.sql</code> en Supabase y recarga.</div>';
    var add = '<form class="add" id="addForm">' +
      '<input id="a-title" placeholder="Nueva tarea…" required>' +
      '<select id="a-acc">' + accOpts('', 'Cuenta') + '</select>' +
      '<select id="a-vp">' + vpOpts('', 'VP') + '</select>' +
      '<select id="a-owner">' + peopleOpts('', 'Responsable') + '</select>' +
      '<input type="date" id="a-due" title="Fecha límite">' +
      '<select id="a-other" title="Si no es de cuenta ni de VP"><option value="">Otro: —</option><option value="partnership">Partnership</option><option value="marketing">Marketing</option></select>' +
      '<button class="btn primary" type="submit">Añadir</button></form>';
    var chips = '<div class="chips">' + QUICK.map(function(q){ return '<button data-q="' + q[0] + '" class="' + (ML.ui.quick === q[0] ? 'on' : '') + '">' + q[1] + '</button>'; }).join(' ') + '</div>';
    var fl = '<div class="filters">' + chips +
      ms('account', 'Todas las cuentas', ML.s.accounts.map(function(a){ return [a.id, a.name]; })) +
      ms('owner', 'Todos los responsables', [['__none', '(sin responsable)']].concat(ML.s.people.map(function(p){ return [p.name, p.name]; }))) +
      ms('vp', 'Todas las VP', ML.VPS.map(function(v){ return [v.k, v.label]; })) +
      ms('pilar', 'Todos los pilares', ML.PILARES) +
      ms('status', 'Todos los estados', ML.STATUS) +
      '<input data-flt="q" placeholder="Buscar (texto o código 01-02)…" value="' + esc(f.q) + '">' +
      '<select id="grp">' + opts([['', 'Sin agrupar'], ['owner', 'Agrupar: responsable'], ['account', 'Agrupar: cuenta'], ['vp', 'Agrupar: VP']], ML.ui.group) + '</select>' +
      '<button class="btn sm" id="clr">Limpiar</button><span class="muted">' + nodes.length + ' tareas · ' + nsub + ' subtareas</span>' +
      '<button class="btn sm" id="exp-all">▾ Expandir todo</button><button class="btn sm" id="col-all">▸ Contraer todo</button>' +
      '<span style="flex:1"></span><button class="btn sm editable" id="imp-paste">📋 Pegar tareas</button><button class="btn sm editable" id="imp">⬆ Importar archivo JSON</button><input type="file" id="impf" accept="application/json,.json,text/plain" hidden><button class="btn sm" id="exp">⬇ Exportar CSV</button></div>';
    var body = '', last = null;
    nodes.forEach(function(n){
      if(ML.ui.group){ var g = groupKey(n.t); if(g !== last){ body += '<tr class="grp"><td colspan="10">' + esc(g) + '</td></tr>'; last = g; } }
      body += row(n, n.t);
      var force = !n.self;   // si la tarea solo aparece por sus subtareas, se muestran siempre
      if(!ML.ui.collapsed[n.t.id] || force) n.kids.forEach(function(k){ body += row(n, k); });
      if(ML.ui.addSub === n.t.id) body += addSubRow(n.t);
    });
    if(!nodes.length) body = '<tr><td colspan="10" class="empty">No hay tareas con este filtro.</td></tr>';
    return warn + add + fl + '<div class="tablewrap"><table class="fx" data-cols="tasks2">' + colgroup('tasks2', TASK_COLS) + '<thead><tr><th></th>' + th('title', 'Tarea / subtarea') + th('account', 'Cuenta') + '<th>VP</th><th>Tipo</th>' + th('owner', 'Responsable') + th('due', 'Fecha límite') + th('status', 'Estado') + th('priority', 'Prior.') + '<th></th></tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function csvCell(v){ v = String(v == null ? '' : v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function exportCsv(){
    var rows = [['Código', 'Nivel', 'Código tarea', 'Título', 'Cuenta', 'VP', 'Pilar', 'Tipo', 'Responsable', 'Fecha límite', 'Estado', 'Prioridad', 'Comentarios']];
    flat(tree()).forEach(function(t){
      var e = ML.eff(t), p = ML.parentOf(t);
      rows.push([ML.code(t), p ? 'Subtarea' : 'Tarea', p ? ML.code(p) : '', t.title, accName(e.account_id), ML.vpLabel(e.vp), ML.lab(ML.PILARES, e.pilar), p ? ML.lab(ML.KINDS, t.kind) : '', t.owner || '', t.due || '', ML.lab(ML.STATUS, t.status), ML.lab(ML.PRIOS, t.priority), t.note]);
    });
    var blob = new Blob(['﻿' + rows.map(function(r){ return r.map(csvCell).join(';'); }).join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tareas-' + ML.today() + '.csv'; document.body.appendChild(a); a.click(); a.remove();
  }

  // Cambiar de estado con coherencia entre tarea y subtareas
  async function setStatus(id, status){
    var t = ML.task(id);
    if(status === 'hecha' && !ML.isSub(t)){
      var open = ML.childrenOf(id).filter(ML.isOpen);
      if(open.length && confirm('La tarea tiene ' + open.length + ' subtarea' + (open.length === 1 ? '' : 's') + ' abierta' + (open.length === 1 ? '' : 's') + '.\n\nAceptar = marcarlas también como hechas.\nCancelar = marcar solo la tarea.')){
        for(var i = 0; i < open.length; i++) await ML.updateTask(open[i].id, { status: 'hecha' });
      }
    }
    await ML.updateTask(id, { status: status });
    if(ML.isSub(t) && status === 'hecha'){
      var p = ML.parentOf(t);
      if(p && p.status !== 'hecha' && ML.childrenOf(p.id).every(function(k){ return k.status === 'hecha'; }) && confirm('Todas las subtareas de «' + p.title + '» están hechas.\n¿Marcar también la tarea como hecha?')) await ML.updateTask(p.id, { status: 'hecha' });
    }
  }

  // Elegir de qué tarea cuelga (convertir en subtarea / mover una subtarea)
  function openParentPicker(id){
    var t = ML.task(id), isMove = ML.isSub(t);
    if(!isMove && ML.childrenOf(id).length){ ML.toast('Esta tarea tiene subtareas: muévelas o conviértelas en tareas antes (solo hay un nivel).', true); return; }
    var cands = ML.topTasks().filter(function(x){ return x.id !== id && x.id !== t.parent_id; }).sort(function(a, b){ return (a.task_no || a.id) - (b.task_no || b.id); });
    var m = $('modal'); m.hidden = false;
    function optsHtml(q){
      q = (q || '').toLowerCase();
      return cands.filter(function(c){ return !q || (ML.code(c) + ' ' + c.title + ' ' + accName(c.account_id)).toLowerCase().indexOf(q) >= 0; })
        .map(function(c){ return '<option value="' + c.id + '">' + esc(ML.code(c) + ' · ' + c.title.slice(0, 80) + (accName(c.account_id) ? ' — ' + accName(c.account_id) : '')) + '</option>'; }).join('');
    }
    m.innerHTML = '<div class="box"><h2>' + (isMove ? 'Cambiar la subtarea de tarea' : 'Convertir en subtarea') + '</h2>' +
      '<p style="margin-top:0"><b>' + esc(ML.code(t)) + ' · ' + esc(t.title) + '</b></p>' +
      '<p class="muted">¿De qué tarea cuelga? Heredará su cuenta, VP y pilar, y su código cambiará (p. ej. ' + esc(ML.code(t)) + ' → 03-04).' + (isMove ? '' : ' Los datos de cuenta y pilar que tenía se conservan, pero dejan de mostrarse.') + '</p>' +
      '<input id="pp-q" placeholder="Filtrar por código, título o cuenta…" style="width:100%;margin-bottom:6px"><select id="pp-sel" size="10" style="width:100%">' + optsHtml('') + '</select>' +
      '<p style="text-align:right;margin-bottom:0"><button class="btn" id="pp-x">Cancelar</button> <button class="btn primary" id="pp-go">Convertir</button></p></div>';
    $('pp-q').focus();
    $('pp-q').oninput = function(){ $('pp-sel').innerHTML = optsHtml($('pp-q').value); };
    $('pp-x').onclick = closeModal;
    $('pp-go').onclick = async function(){
      var val = $('pp-sel').value; if(!val){ ML.toast('Elige la tarea de la que cuelga', true); return; }
      var err = await ML.moveUnder(id, +val); closeModal();
      if(err) ML.toast(err, true); else ML.toast('Hecho: ahora es la subtarea ' + ML.code(ML.task(id)));
      ML.rerender();
    };
  }

  function bindTasks(v){
    var ui = ML.ui;
    var af = v.querySelector('#addForm');
    var accSel = v.querySelector('#a-acc');
    accSel.addEventListener('change', function(){ var a = ML.account(accSel.value); if(a && a.am) v.querySelector('#a-owner').value = a.am; });
    af.addEventListener('submit', async function(e){
      e.preventDefault();
      var acc = accSel.value, vp = v.querySelector('#a-vp').value, other = v.querySelector('#a-other').value;
      var title = v.querySelector('#a-title').value.trim(); if(!title) return;
      var t = await ML.addTask({ title: title, account_id: acc, vp: vp, pilar: acc ? 'clientes' : vp ? 'vp' : (other || 'clientes'), kind: 'otro', owner: v.querySelector('#a-owner').value, due: v.querySelector('#a-due').value });
      if(t) ML.toast('Tarea ' + ML.code(t) + ' añadida'); ML.rerender();
      var ti = document.getElementById('a-title'); if(ti) ti.focus();
    });
    v.querySelectorAll('[data-q]').forEach(function(b){ b.onclick = function(){ ui.quick = b.dataset.q; ML.rerender(); }; });
    v.querySelectorAll('[data-msb]').forEach(function(b){ b.onclick = function(e){ e.stopPropagation(); ui.msOpen = ui.msOpen === b.dataset.msb ? null : b.dataset.msb; ML.rerender(); }; });
    v.querySelectorAll('[data-msk]').forEach(function(c){ c.onchange = function(){
      var arr = ui.f[c.dataset.msk], i = arr.indexOf(c.value);
      if(c.checked && i < 0) arr.push(c.value); else if(!c.checked && i >= 0) arr.splice(i, 1);
      ML.rerender();
    }; });
    var qi = v.querySelector('[data-flt=q]');
    qi.addEventListener('input', function(){ ui.f.q = qi.value; var pos = qi.selectionStart; ML.rerender(); var n = document.querySelector('[data-flt=q]'); n.focus(); try{ n.setSelectionRange(pos, pos); }catch(e){} });
    v.querySelector('#grp').onchange = function(e){ ui.group = e.target.value; ML.rerender(); };
    v.querySelector('#clr').onclick = function(){ ui.f = { account: [], owner: [], vp: [], pilar: [], status: [], q: '' }; ui.quick = 'abiertas'; ui.group = ''; ui.msOpen = null; ML.rerender(); };
    v.querySelector('#exp-all').onclick = function(){ ui.collapsed = {}; ML.rerender(); };
    v.querySelector('#col-all').onclick = function(){ ML.topTasks().forEach(function(t){ if(ML.childrenOf(t.id).length) ui.collapsed[t.id] = true; }); ML.rerender(); };
    v.querySelector('#exp').onclick = exportCsv;
    var impf = v.querySelector('#impf');
    v.querySelector('#imp').onclick = function(){ impf.click(); };
    v.querySelector('#imp-paste').onclick = function(){ openPaste(); };
    impf.onchange = async function(){
      var file = impf.files[0]; if(!file) return;
      try{ openPreview(parseImport(await file.text())); }catch(err){ ML.toast('No se pudo leer el archivo: ' + err.message, true); }
      impf.value = '';
    };
    v.querySelectorAll('th[data-sort]').forEach(function(h){ h.onclick = function(){ var k = h.dataset.sort; if(ui.sort === k) ui.dir = -ui.dir; else { ui.sort = k; ui.dir = 1; } ML.rerender(); }; });
    var tb = v.querySelector('tbody');
    tb.addEventListener('change', async function(e){
      var el = e.target, tr = el.closest('tr'), id = tr && +tr.dataset.id, f = el.dataset.f;
      if(!id || !f) return;
      if(f === 'done' || f === 'status'){ await setStatus(id, f === 'done' ? (el.checked ? 'hecha' : 'pendiente') : el.value); ML.rerender(); return; }
      var patch = {};
      if(f === 'account_id' || f === 'vp'){
        patch[f] = el.value || null;
        var t = ML.task(id), acc = f === 'account_id' ? el.value : t.account_id, vp = f === 'vp' ? el.value : t.vp;
        if(t.pilar === 'clientes' || t.pilar === 'vp') patch.pilar = acc ? 'clientes' : vp ? 'vp' : 'clientes';
        if(f === 'account_id' && el.value && !t.owner){ var a = ML.account(el.value); if(a && a.am) patch.owner = a.am; }
      }
      else if(f === 'owner') patch.owner = el.value || null;
      else if(f === 'due') patch.due = el.value || null;   // si es tarea con subtareas, ML.syncDue la mantiene >= la última subtarea
      else if(f === 'title'){ if(!el.value.trim()){ ML.rerender(); return; } patch.title = el.value.trim(); }
      else patch[f] = el.value;
      var before = patch.due; await ML.updateTask(id, patch);
      if(f === 'due'){ var tt = ML.task(id); if(tt && !tt.parent_id && (tt.due || null) !== (before || null)) ML.toast('La fecha de la tarea no puede ser anterior a la de su última subtarea (' + ML.fmt(tt.due) + ')'); else if(tt && tt.parent_id){ var pp = ML.parentOf(tt); if(pp && pp.due === tt.due && before) ML.toast('Fecha de la tarea ' + ML.code(pp) + ' ajustada a ' + ML.fmt(pp.due)); } }
      ML.rerender();
    });
    tb.addEventListener('submit', async function(e){
      var f = e.target; if(!f.dataset.addsub) return; e.preventDefault();
      var pid = +f.dataset.addsub, fd = new FormData(f), title = String(fd.get('title') || '').trim(); if(!title) return;
      var s = await ML.addSubtask(pid, { title: title, kind: fd.get('kind'), owner: fd.get('owner'), due: fd.get('due') });
      if(s) ML.toast('Subtarea ' + ML.code(s) + ' añadida'); ML.rerender();
      var inp = document.querySelector('form[data-addsub="' + pid + '"] input[name=title]'); if(inp) inp.focus();
    });
    tb.addEventListener('click', async function(e){
      var b = e.target.closest('[data-a]'); if(!b) return;
      var tr = b.closest('tr'), id = +(tr.dataset.id || tr.dataset.parent), a = b.dataset.a, t = ML.task(id);
      if(a === 'toggle'){ ui.collapsed[id] = !ui.collapsed[id]; ML.rerender(); }
      else if(a === 'addsub'){ ui.addSub = ui.addSub === id ? null : id; ui.collapsed[id] = false; ML.rerender(); var i2 = document.querySelector('form[data-addsub] input[name=title]'); if(i2) i2.focus(); }
      else if(a === 'cancelsub'){ ui.addSub = null; ML.rerender(); }
      else if(a === 'tosub' || a === 'move'){ openParentPicker(id); }
      else if(a === 'promote'){
        if(confirm('¿Convertir la subtarea ' + ML.code(t) + ' en una tarea?\n\nHeredará la cuenta, VP y pilar de su tarea actual.')){ var err = await ML.promote(id); if(err) ML.toast(err, true); else ML.toast('Ahora es la tarea ' + ML.code(ML.task(id))); ML.rerender(); }
      }
      else if(a === 'del'){
        var nk = ML.childrenOf(id).length;
        if(confirm('¿Eliminar ' + (ML.isSub(t) ? 'la subtarea ' : 'la tarea ') + ML.code(t) + '?' + (nk ? '\n\nSe eliminarán también sus ' + nk + ' subtarea' + (nk === 1 ? '' : 's') + '.' : '') + '\nNo se puede deshacer.')){ await ML.deleteTask(id); ML.toast('Eliminada'); ML.rerender(); }
      }
    });
  }

  // ======================= CUENTAS =======================
  function accountsView(){
    var ui = ML.ui, f = ui.accF || (ui.accF = { am: '', q: '', vp: '', stage: '' }), q = f.q.trim().toLowerCase();
    var list = ML.s.accounts.filter(function(a){ if(!a.active && !f.showInactive) return false; if(f.am && a.am !== f.am) return false;
      if(q && a.name.toLowerCase().indexOf(q) < 0) return false;
      if(f.vp || f.stage){
        return ML.s.stages.some(function(s){ return s.account_id === a.id && (!f.vp || s.vp === f.vp) && (f.stage ? s.stage === f.stage : s.stage !== 'no_aplica'); });
      }
      return true; });
    var opn = {}; openTasks().filter(function(t){ return !t.parent_id; }).forEach(function(t){ if(t.account_id) opn[t.account_id] = (opn[t.account_id] || 0) + 1; });
    var head = '<div class="filters"><select id="af-am">' + peopleOpts(f.am, 'Todos los AM') + '</select><input id="af-q" placeholder="Buscar cuenta…" value="' + esc(f.q) + '">' +
      '<select id="af-vp">' + vpOpts(f.vp, 'Todas las VP') + '</select><select id="af-st">' + opts(ML.STAGES, f.stage, 'Todas las etapas') + '</select><label class="muted"><input type="checkbox" id="af-inact"' + (f.showInactive ? ' checked' : '') + '> Ver inactivas</label><button class="btn sm" id="af-clr">Limpiar</button>' +
      '<span class="muted">' + list.length + ' cuentas</span><span style="flex:1"></span>' +
      '<button class="btn sm editable" id="add-acc">+ Cuenta</button><button class="btn sm editable" id="add-per">+ Responsable</button></div>';
    var th = '<thead><tr><th>Cuenta</th><th>AM</th>' + ML.VPS.map(function(v){ return '<th>' + esc(v.label) + '</th>'; }).join('') + '<th>Tareas abiertas</th><th></th></tr></thead>';
    var body = list.map(function(a){
      var tds = ML.VPS.map(function(v){
        var s = ML.stageOf(a.id, v.k), st = s ? s.stage : 'no_aplica';
        return '<td class="editable"><select class="stsel st-' + st + '"' + stStyle(st, ';color:#fff') + ' data-vp="' + v.k + '">' + opts(ML.STAGES, st) + '</select></td>';
      }).join('');
      var r = '<tr data-acc="' + esc(a.id) + '"' + (a.active ? '' : ' style="opacity:.55"') + '><td><b>' + esc(a.name) + '</b>' + (a.active ? '' : ' <span class="muted">(inactiva)</span>') + '</td><td class="editable"><select data-am>' + peopleOpts(a.am, '—') + '</select></td>' + tds +
        '<td>' + (opn[a.id] ? '<a href="#" data-go="' + esc(a.id) + '">' + opn[a.id] + '</a>' : '<span class="muted">0</span>') + '</td>' +
        '<td class="act"><button class="btn sm" data-detail>' + (ui.openAcc === a.id ? '▲' : '▼') + '</button></td></tr>';
      if(ui.openAcc === a.id){
        r += '<tr><td colspan="' + (ML.VPS.length + 4) + '" class="note editable"><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">' +
          ML.VPS.map(function(v){ var s = ML.stageOf(a.id, v.k) || {}; return '<div><b>' + esc(v.label) + '</b><br><textarea data-note="' + v.k + '" placeholder="Notas (caso de uso, motivo de aparcado…)">' + esc(s.note) + '</textarea><br><label class="muted">Revisar el <input type="date" data-rev="' + v.k + '" value="' + esc(s.review_date || '') + '"></label></div>'; }).join('') +
          '<div><b>Cuenta</b><br><input data-accname value="' + esc(a.name) + '" style="width:100%;margin:3px 0"><br><label><input type="checkbox" data-accactive' + (a.active ? ' checked' : '') + '> Activa (visible en listas y desplegables)</label><br><textarea data-accnote placeholder="Nota de la cuenta">' + esc(a.note) + '</textarea><br><button class="btn sm danger" data-delacc>Borrar cuenta</button></div></div></td></tr>';
      }
      return r;
    }).join('') || '<tr><td colspan="' + (ML.VPS.length + 4) + '" class="empty">Sin cuentas</td></tr>';
    var cd = accCols(); return head + '<div class="tablewrap"><table class="fx" data-cols="acc' + cd.length + '">' + colgroup('acc' + cd.length, cd) + th + '<tbody>' + body + '</tbody></table></div>';
  }
  function bindAccounts(v){
    var ui = ML.ui;
    v.querySelector('#af-am').onchange = function(e){ ui.accF.am = e.target.value; ML.rerender(); };
    v.querySelector('#af-vp').onchange = function(e){ ui.accF.vp = e.target.value; ML.rerender(); };
    v.querySelector('#af-st').onchange = function(e){ ui.accF.stage = e.target.value; ML.rerender(); };
    v.querySelector('#af-clr').onclick = function(){ ui.accF = { am: '', q: '', vp: '', stage: '', showInactive: false }; ML.rerender(); };
    v.querySelector('#af-inact').onchange = function(e){ ui.accF.showInactive = e.target.checked; ML.rerender(); };
    v.querySelector('#af-q').oninput = function(e){ ui.accF.q = e.target.value; var p = e.target.selectionStart; ML.rerender(); var n = document.getElementById('af-q'); n.focus(); try{ n.setSelectionRange(p, p); }catch(x){} };
    v.querySelector('#add-acc').onclick = async function(){ var n = prompt('Nombre de la cuenta:'); if(n && n.trim()){ var a = await ML.addAccount(n.trim(), ''); if(a){ ui.openAcc = a.id; ML.rerender(); } } };
    v.querySelector('#add-per').onclick = async function(){ var n = prompt('Nombre del responsable (AM):'); if(n && n.trim()){ await ML.addPerson(n.trim()); ML.rerender(); } };
    v.querySelectorAll('[data-go]').forEach(function(a){ a.onclick = function(e){ e.preventDefault(); ui.f.account = [a.dataset.go]; ui.quick = 'abiertas'; ML.setTab('tasks'); }; });
    var tb = v.querySelector('tbody');
    tb.addEventListener('change', async function(e){
      var el = e.target, tr = el.closest('tr[data-acc]'); 
      if(!tr){ var prev = el.closest('tr').previousElementSibling; tr = prev; }
      var id = tr && tr.dataset.acc; if(!id) return;
      if(el.dataset.vp){ await ML.setStage(id, el.dataset.vp, { stage: el.value }); ML.rerender(); }
      else if('am' in el.dataset){ await ML.updateAccount(id, { am: el.value || null }); ML.rerender(); }
      else if(el.dataset.note){ await ML.setStage(id, el.dataset.note, { note: el.value }); ML.toast('Guardado'); }
      else if(el.dataset.rev){ await ML.setStage(id, el.dataset.rev, { review_date: el.value || null }); ML.toast('Guardado'); }
      else if('accnote' in el.dataset){ await ML.updateAccount(id, { note: el.value }); ML.toast('Guardado'); }
      else if('accname' in el.dataset){ if(el.value.trim()){ await ML.updateAccount(id, { name: el.value.trim() }); ML.toast('Guardado'); } ML.rerender(); }
      else if('accactive' in el.dataset){ await ML.updateAccount(id, { active: el.checked }); ML.rerender(); }
    });
    tb.addEventListener('click', async function(e){
      var b = e.target.closest('[data-detail],[data-delacc]'); if(!b) return;
      var tr = b.closest('tr'); if(!tr.dataset.acc) tr = tr.previousElementSibling;
      var id = tr.dataset.acc;
      if(b.hasAttribute('data-detail')){ ui.openAcc = ui.openAcc === id ? null : id; ML.rerender(); }
      else if(confirm('¿Borrar la cuenta y sus etapas? Sus tareas se conservarán sin cuenta.')){ await ML.deleteAccount(id); ui.openAcc = null; ML.rerender(); }
    });
  }

  // ======================= IMPORTAR: pegar / vista previa editable =======================
  function parseImport(text){
    var t = String(text || '').trim();
    var m = t.match(/```(?:json)?\s*([\s\S]*?)```/i); if(m) t = m[1].trim();            // admite el bloque de código tal como lo devuelve Copilot
    var i = t.indexOf('['), j = t.lastIndexOf(']'); if(i >= 0 && j > i) t = t.slice(i, j + 1);
    var data = JSON.parse(t);
    if(!Array.isArray(data)) throw new Error('debe ser una lista de tareas (JSON entre corchetes)');
    if(!data.length) throw new Error('la lista está vacía');
    return data;
  }
  function closeModal(){ $('modal').hidden = true; $('modal').innerHTML = ''; ML.importDrafts = null; }
  function openPaste(){
    var m = $('modal');
    m.innerHTML = '<div class="box"><h2>Pegar tareas</h2><p class="muted" style="margin-top:0">Pega aquí el JSON que te devuelve el agente (vale con el bloque de código completo). Lo verás en una vista previa antes de guardar nada.</p>' +
      '<textarea id="paste-ta" style="width:100%;height:220px;font-family:ui-monospace,monospace;font-size:12px" placeholder=\'[{"title":"…","account":"","vp":"","kind":"otro","owner":"","due":"2026-12-01","priority":"media","note":""}]\'></textarea>' +
      '<p style="text-align:right;margin-bottom:0"><button class="btn" id="paste-x">Cancelar</button> <button class="btn primary" id="paste-go">Revisar tareas</button></p></div>';
    m.hidden = false; $('paste-ta').focus();
    $('paste-x').onclick = closeModal;
    $('paste-go').onclick = function(){ try{ openPreview(parseImport($('paste-ta').value)); }catch(err){ ML.toast('JSON no válido: ' + err.message, true); } };
  }
  function openPreview(arr){
    var drafts = ML.prepareImport(arr); ML.importDrafts = drafts;
    var m = $('modal'); m.hidden = false;
    function paint(){
      var inc = drafts.filter(function(d){ return d.include; }).length, dups = drafts.filter(function(d){ return d.dup; }).length;
      var rows = drafts.map(function(d, i){
        var warn = d.warns.length ? '<div class="pv-warn">⚠ ' + d.warns.map(esc).join(' · ') + '</div>' : '';
        return '<tr data-i="' + i + '"' + (d.include ? '' : ' class="pv-off"') + '><td><input type="checkbox" data-p="include"' + (d.include ? ' checked' : '') + ' title="Incluir"></td>' +
          '<td>' + ((d.parent_id || d.parentKey) ? '<span class="tid" title="Se importará como subtarea de esta tarea">↳ subtarea de ' + d.parentCode + '</span>' : '') + '<input class="title" data-p="title" value="' + esc(d.title) + '">' + warn + '</td>' +
          ((d.parent_id || d.parentKey) ? '<td class="inh" colspan="2">hereda de la tarea ' + d.parentCode + '</td>' :
          '<td><select data-p="account_id">' + accOpts(d.account_id, '—') + '</select></td>' +
          '<td><select data-p="vp">' + vpOpts(d.vp, '—') + '</select></td>') +
          '<td><select data-p="owner">' + peopleOpts(d.owner, '—') + '</select></td>' +
          '<td><input type="date" data-p="due" value="' + esc(d.due) + '"></td>' +
          '<td><select data-p="priority">' + opts(ML.PRIOS, d.priority) + '</select></td>' +
          '<td><input data-p="note" value="' + esc(d.note) + '" placeholder="Comentarios…"></td>' +
          '<td><button class="btn sm danger rd" data-p="remove" title="Quitar de la importación">🗑</button></td></tr>';
      }).join('');
      m.innerHTML = '<div class="box wide"><h2>Vista previa de la importación</h2>' +
        '<p class="muted" style="margin-top:0">Edita lo que quieras, desmarca o quita lo que no te sirva. No se guarda nada hasta pulsar «Importar». ' + (dups ? '<b>' + dups + ' parecen duplicadas</b> y vienen desmarcadas.' : '') + '</p>' +
        '<div class="filters"><button class="btn sm" id="pv-all">Marcar todas</button><button class="btn sm" id="pv-none">Desmarcar todas</button><span class="muted">' + inc + ' de ' + drafts.length + ' seleccionadas</span></div>' +
        '<div class="tablewrap" style="max-height:55vh;overflow:auto"><table class="pv"><colgroup><col style="width:3%"><col style="width:29%"><col style="width:12%"><col style="width:10%"><col style="width:12%"><col style="width:12%"><col style="width:7%"><col style="width:13%"><col style="width:2%"></colgroup><thead><tr><th></th><th>Tarea</th><th>Cuenta</th><th>VP</th><th>Responsable</th><th>Fecha límite</th><th>Prior.</th><th>Comentarios</th><th></th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="9" class="empty">No queda ninguna tarea.</td></tr>') + '</tbody></table></div>' +
        '<p style="text-align:right;margin-bottom:0"><button class="btn" id="pv-x">Cancelar</button> <button class="btn primary" id="pv-go"' + (inc ? '' : ' disabled') + '>Importar ' + inc + ' tarea' + (inc === 1 ? '' : 's') + '</button></p></div>';
      $('pv-x').onclick = closeModal;
      $('pv-all').onclick = function(){ drafts.forEach(function(d){ d.include = true; }); paint(); };
      $('pv-none').onclick = function(){ drafts.forEach(function(d){ d.include = false; }); paint(); };
      $('pv-go').onclick = async function(){
        $('pv-go').disabled = true; $('pv-go').textContent = 'Importando…';
        var n = await ML.commitImport(drafts); closeModal();
        ML.toast(n + ' elemento' + (n === 1 ? '' : 's') + ' importado' + (n === 1 ? '' : 's') + (ML.lastSkipped ? ' · ' + ML.lastSkipped + ' omitido' + (ML.lastSkipped === 1 ? '' : 's') + ' (sin tarea padre o con error)' : ''), n === 0 || !!ML.lastSkipped); ML.rerender();
      };
      var tb = m.querySelector('tbody');
      tb.addEventListener('change', function(e){
        var el = e.target, tr = el.closest('tr[data-i]'), f = el.dataset.p; if(!tr || !f || f === 'remove') return;
        var d = drafts[+tr.dataset.i];
        if(f === 'include'){ d.include = el.checked; paint(); return; }
        d[f] = el.value;
        if(f === 'account_id' && el.value && !d.owner){ var a = ML.account(el.value); if(a && a.am) d.owner = a.am; paint(); }
      });
      tb.addEventListener('click', function(e){
        var b = e.target.closest('[data-p=remove]'); if(!b) return;
        drafts.splice(+b.closest('tr').dataset.i, 1); paint();
      });
    }
    paint();
  }

  // ======================= CONFIGURACIÓN =======================
  function sortSel(kind){ var m = ML.sortMode(kind); return '<select data-sortmode="' + kind + '" title="Orden de la lista y de los desplegables"><option value="alpha"' + (m === 'alpha' ? ' selected' : '') + '>Orden: alfabético</option><option value="manual"' + (m === 'manual' ? ' selected' : '') + '>Orden: manual</option></select>'; }
  function cfgList(kind){
    var rows = ML.rows[kind], sys = ML.SYSTEM[kind], hasColor = kind === 'stage' || kind === 'pilar' || kind === 'status' || kind === 'priority', alpha = ML.sortMode(kind) === 'alpha';
    var body = rows.map(function(r, i){
      var isSys = sys.indexOf(r.key) >= 0, used = ML.listUsed(kind, r.key);
      return '<tr data-kind="' + kind + '" data-key="' + esc(r.key) + '">' +
        '<td class="editable"><input data-lf="label" value="' + esc(r.label) + '" style="width:100%"></td>' +
        (hasColor ? '<td class="editable"><input type="color" data-lf="color" value="' + (kind === 'stage' ? (r.color || '#888888') : (ML.listColor(kind, r.key) || '#888888')) + '" title="Color">' + (r.color ? ' <button class="btn sm" data-la="uncolor" title="Color por defecto">↺</button>' : '') + '</td>' : '') +
        '<td class="muted" title="Clave interna (no cambia al renombrar)">' + esc(r.key) + (isSys ? ' 🔒' : '') + '</td><td class="muted">' + used + '</td>' +
        '<td class="editable"><input type="checkbox" data-lf="active" ' + (r.active || isSys ? 'checked' : '') + (isSys ? ' disabled' : '') + ' title="Activo"></td>' +
        '<td class="act editable">' + (alpha ? '' : '<button class="btn sm" data-la="up"' + (i === 0 ? ' disabled' : '') + '>↑</button> <button class="btn sm" data-la="down"' + (i === rows.length - 1 ? ' disabled' : '') + '>↓</button> ') +
        '<button class="btn sm danger" data-la="del"' + (isSys ? ' disabled title="Valor del sistema"' : '') + '>🗑</button></td></tr>';
    }).join('');
    return '<div class="panel"><div class="filters" style="margin-bottom:6px"><h2 style="margin:0">' + esc(ML.LIST_TITLES[kind]) + '</h2>' + sortSel(kind) + '</div><div class="tablewrap"><table style="min-width:0"><thead><tr><th>Nombre</th>' + (hasColor ? '<th>Color</th>' : '') + '<th>Clave</th><th>En uso</th><th>Activo</th><th></th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<form class="filters editable" data-addlist="' + kind + '" style="margin:8px 0 0"><input placeholder="Nuevo valor…" required><button class="btn sm primary" type="submit">Añadir</button></form></div>';
  }
  function configView(){
    var warn = ML.listsOk ? '' : '<div class="panel" style="border-color:var(--over);margin-bottom:14px"><b>Las listas aún no son editables.</b> Ejecuta <code>supabase/migration_v3.sql</code> en Supabase (SQL Editor) y recarga. Mientras tanto se usan los valores por defecto.</div>';
    var people = ML.s.people.map(function(p, i){
      return '<tr data-person="' + esc(p.name) + '"><td class="editable"><input data-pf="name" value="' + esc(p.name) + '" style="width:100%"></td>' +
        '<td class="muted">' + (ML.s.accounts.filter(function(a){ return a.am === p.name; }).length) + ' cuentas · ' + ML.s.tasks.filter(function(t){ return t.owner === p.name && ML.isOpen(t); }).length + ' tareas abiertas</td>' +
        '<td class="editable"><input type="checkbox" data-pf="active"' + (p.active ? ' checked' : '') + ' title="Activo"></td>' +
        '<td class="act editable">' + (ML.sortMode('people') === 'alpha' ? '' : '<button class="btn sm" data-pa="up"' + (i === 0 ? ' disabled' : '') + '>↑</button> <button class="btn sm" data-pa="down"' + (i === ML.s.people.length - 1 ? ' disabled' : '') + '>↓</button> ') + '<button class="btn sm danger" data-pa="del">🗑</button></td></tr>';
    }).join('');
    var peoplePanel = '<div class="panel"><div class="filters" style="margin-bottom:6px"><h2 style="margin:0">Responsables (AM)</h2>' + sortSel('people') + '</div><div class="tablewrap"><table style="min-width:0"><thead><tr><th>Nombre</th><th>Uso</th><th>Activo</th><th></th></tr></thead><tbody>' + people + '</tbody></table></div>' +
      '<form class="filters editable" id="addPerson" style="margin:8px 0 0"><input placeholder="Nuevo responsable…" required><button class="btn sm primary" type="submit">Añadir</button></form>' +
      '<p class="muted" style="font-size:12px">Renombrar actualiza también las cuentas y tareas. Borrar deja esas cuentas y tareas sin responsable.</p></div>';
    var lists = ['vp', 'stage', 'status', 'kind', 'pilar', 'priority'].map(cfgList).join('');
    return warn + '<p class="muted" style="margin-top:0;max-width:820px">Renombrar un valor cambia cómo se ve en toda la app; los datos existentes siguen enlazados por su clave interna. 🔒 = valor que la lógica necesita (se renombra, no se borra). «Activo» desmarcado lo oculta de los desplegables sin tocar los datos antiguos. Las cuentas se editan en la pestaña Cuentas.</p><div class="cfgstack">' + peoplePanel + lists + '</div>';
  }
  function bindConfig(v){
    if(v.__cfg) return; v.__cfg = true;   // #view es el mismo elemento en cada render: enlazar una sola vez
    v.addEventListener('submit', async function(e){
      if(ML.ui.tab !== 'config') return;
      var f = e.target; e.preventDefault();
      if(f.dataset.addlist){ var i = f.querySelector('input'); if(await ML.listAdd(f.dataset.addlist, i.value)) ML.toast('Añadido'); ML.rerender(); }
      else if(f.id === 'addPerson'){ var n = f.querySelector('input').value.trim(); if(n){ await ML.addPerson(n); ML.toast('Añadido'); ML.rerender(); } }
      else if(f.id === 'addAcc'){ var nm = f.querySelector('input').value.trim(); if(nm){ await ML.addAccount(nm, f.querySelector('select').value); ML.toast('Añadida'); ML.rerender(); } }
    });
    v.addEventListener('change', async function(e){
      if(ML.ui.tab !== 'config') return;
      var el = e.target;
      if(el.dataset.sortmode){ ML.setSortMode(el.dataset.sortmode, el.value); ML.rerender(); return; }
      var tr = el.closest('tr'); if(!tr) return;
      if(el.dataset.lf){
        var val = el.dataset.lf === 'active' ? el.checked : el.value.trim();
        if(el.dataset.lf === 'label' && !val){ ML.rerender(); return; }
        await ML.listUpdate(tr.dataset.kind, tr.dataset.key, (function(){ var o = {}; o[el.dataset.lf] = val; return o; })()); ML.rerender();
      } else if(el.dataset.pf){
        if(el.dataset.pf === 'name') await ML.renamePerson(tr.dataset.person, el.value); else await ML.updatePerson(tr.dataset.person, { active: el.checked });
        ML.rerender();
      } else if(el.dataset.af){
        var id = tr.dataset.acc, patch = {};
        if(el.dataset.af === 'active') patch.active = el.checked; else if(el.dataset.af === 'am') patch.am = el.value || null; else { if(!el.value.trim()){ ML.rerender(); return; } patch.name = el.value.trim(); }
        await ML.updateAccount(id, patch); ML.rerender();
      }
    });
    v.addEventListener('click', async function(e){
      if(ML.ui.tab !== 'config') return;
      var b = e.target.closest('[data-la],[data-pa],[data-aa]'); if(!b || b.disabled) return;
      var tr = b.closest('tr');
      if(b.dataset.la){
        var k = tr.dataset.kind, key = tr.dataset.key;
        if(b.dataset.la === 'up') await ML.listMove(k, key, -1);
        else if(b.dataset.la === 'down') await ML.listMove(k, key, 1);
        else if(b.dataset.la === 'uncolor') await ML.listUpdate(k, key, { color: '' });
        else if(b.dataset.la === 'del' && confirm('¿Borrar este valor?')) await ML.listDelete(k, key);
        ML.rerender();
      } else if(b.dataset.pa){
        var nm = tr.dataset.person;
        if(b.dataset.pa === 'up') await ML.movePerson(nm, -1); else if(b.dataset.pa === 'down') await ML.movePerson(nm, 1);
        else if(confirm('¿Borrar a ' + nm + '? Sus cuentas y tareas quedarán sin responsable.')) await ML.deletePerson(nm);
        ML.rerender();
      } else if(b.dataset.aa === 'del'){
        if(confirm('¿Borrar la cuenta y sus etapas? Sus tareas se conservan sin cuenta. Si solo quieres ocultarla, desmarca «Activa».')){ await ML.deleteAccount(tr.dataset.acc); ML.rerender(); }
      }
    });
  }

  // ======================= Render principal =======================
  ML.render = function(){
    var v = $('view'), ui = ML.ui;
    document.querySelectorAll('#tabs button').forEach(function(b){ b.classList.toggle('active', b.dataset.tab === ui.tab); });
    ML.counters();
    if(ui.tab === 'dashboard'){
      v.innerHTML = dashboard();
      v.querySelectorAll('[data-quick]').forEach(function(k){ k.onclick = function(){ ui.quick = k.dataset.quick; ML.setTab('tasks'); }; });
      var kd = v.querySelector('#kpiDays'); if(kd) kd.onchange = function(){ ui.kpiDays = +kd.value; ML.rerender(); };
      v.querySelectorAll('[data-acc-go]').forEach(function(r){ r.onclick = function(){ ui.f = { account: [r.dataset.accGo], owner: [], vp: [], pilar: [], status: [], q: '' }; ui.quick = 'todas'; ui.group = ''; ML.setTab('tasks'); }; });
      v.querySelectorAll('[data-own]').forEach(function(r){ r.onclick = function(e){
        var seg = e.target.closest('[data-seg]'), k = seg ? seg.dataset.seg : '';
        ui.f = { account: [], owner: [r.dataset.own], vp: [], pilar: [], status: [], q: '' }; ui.group = ''; ui.msOpen = null;
        ui.quick = k === 'over' ? 'vencidas' : (k === 'soon' || k === 'week') ? 'semana' : k === 'none' ? 'sinfecha' : 'abiertas';
        ML.setTab('tasks');
      }; });
      v.querySelectorAll('.bar-row[data-vp]').forEach(function(r){ r.onclick = function(e){
        var sg = e.target.closest('[data-st]');
        ui.accF = { am: '', q: '', vp: r.dataset.vp, stage: sg ? sg.dataset.st : '' };
        ML.setTab('accounts');
      }; });
    } else if(ui.tab === 'tasks'){ v.innerHTML = tasksView(); bindTasks(v); makeResizable(v.querySelector('table.fx')); }
    else if(ui.tab === 'config'){ v.innerHTML = configView(); bindConfig(v); }
    else { v.innerHTML = accountsView(); bindAccounts(v); makeResizable(v.querySelector('table.fx')); }
  };
  ML.rerender = ML.render;
  document.addEventListener('click', function(e){
    if(ML.ui.msOpen && !e.target.closest('.ms')){ ML.ui.msOpen = null; ML.render(); }
  });
  ML.setTab = function(t){ ML.ui.tab = t; ML.render(); window.scrollTo(0, 0); };

  // Recordatorio al abrir: vencidas y próximas (una vez por sesión del navegador)
  ML.showReminders = function(){
    try{ if(sessionStorage.getItem('ml_rem') === ML.today()) return; }catch(e){}
    var l = openLeaves().filter(function(t){ var u = ML.urgency(t); return u === 'over' || u === 'soon' || u === 'week'; }).sort(function(a, b){ return a.due < b.due ? -1 : 1; });
    if(!l.length) return;
    var m = $('modal');
    m.innerHTML = '<div class="box"><h2>Recordatorio · ' + l.length + ' tarea' + (l.length === 1 ? '' : 's') + ' requieren atención</h2><div class="list">' +
      l.slice(0, 20).map(function(t){ var u = ML.urgency(t); return '<div class="it"><span class="t"><span class="tid">' + ML.code(t) + '</span> ' + esc(t.title) + '<br><span class="m">' + esc([accName(ML.eff(t).account_id), t.owner].filter(Boolean).join(' · ')) + '</span></span><span class="pill ' + u + '">' + ML.fmt(t.due) + ' · ' + ML.dueText(t) + '</span></div>'; }).join('') +
      (l.length > 20 ? '<p class="muted">… y ' + (l.length - 20) + ' más</p>' : '') + '</div><p style="text-align:right"><button class="btn" id="rem-x">Cerrar</button> <button class="btn primary" id="rem-go">Ver tareas</button></p></div>';
    m.hidden = false;
    var close = function(){ m.hidden = true; try{ sessionStorage.setItem('ml_rem', ML.today()); }catch(e){} };
    $('rem-x').onclick = close; $('rem-go').onclick = function(){ close(); ML.ui.quick = 'semana'; ML.setTab('tasks'); };
  };
})();
