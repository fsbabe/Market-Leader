/* Vistas: cuadro de mando, tareas y cuentas. */
(function(){
  'use strict';
  var ML = window.ML, esc = ML.esc;
  ML.ui = { tab: 'dashboard', quick: 'abiertas', f: { account: [], owner: [], vp: [], pilar: [], status: [], q: '' }, msOpen: null, group: '', sort: 'due', dir: 1, openNote: null, openAcc: null };
  var $ = function(id){ return document.getElementById(id); };

  function opts(list, sel, blank){
    var h = blank != null ? '<option value="">' + esc(blank) + '</option>' : '';
    list.forEach(function(o){ var k = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; h += '<option value="' + esc(k) + '"' + (k === sel ? ' selected' : '') + '>' + esc(l) + '</option>'; });
    return h;
  }
  function accOpts(sel, blank){ return opts(ML.s.accounts.filter(function(a){ return a.active || a.id === sel; }).map(function(a){ return [a.id, a.name]; }), sel, blank); }
  function peopleOpts(sel, blank){ return opts(ML.s.people.filter(function(p){ return p.active || p.name === sel; }).map(function(p){ return [p.name, p.name]; }), sel, blank); }
  function vpOpts(sel, blank){ return opts(ML.VPS.map(function(v){ return [v.k, v.label]; }), sel, blank); }
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

  // Contadores de cabecera (recordatorios en la app)
  ML.counters = function(){
    var o = openTasks(), over = 0, soon = 0;
    o.forEach(function(t){ var u = ML.urgency(t); if(u === 'over') over++; else if(u === 'soon') soon++; });
    var co = $('chip-over'), cs = $('chip-soon');
    co.hidden = !over; co.textContent = over + ' vencida' + (over === 1 ? '' : 's');
    cs.hidden = !soon; cs.textContent = soon + ' en ≤3 días';
    $('b-open').textContent = o.length ? '(' + o.length + ')' : '';
  };

  // ======================= CUADRO DE MANDO =======================
  function dashboard(){
    var o = openTasks(), t = ML.today();
    var cnt = { over: 0, soon: 0, week: 0, none: 0, noOwner: 0 };
    o.forEach(function(x){ var u = ML.urgency(x); if(cnt[u] != null) cnt[u]++; if(!x.owner) cnt.noOwner++; });
    var d30 = ML.s.tasks.filter(function(x){ return x.status === 'hecha' && x.done_at && (Date.now() - new Date(x.done_at).getTime()) < 30 * 864e5; }).length;
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
      var segs = ML.STAGES.filter(function(s){ return c[s[0]]; }).map(function(s){ return '<i class="st-' + s[0] + '" data-vp="' + v.k + '" data-st="' + s[0] + '" style="width:' + (c[s[0]] / tot * 100) + '%" title="' + esc(s[1]) + ': ' + c[s[0]] + '"></i>'; }).join('');
      return '<div class="bar-row link" data-vp="' + v.k + '"><span class="nm">' + esc(v.label) + '</span><div class="bar">' + segs + '</div><b>' + tot + '</b></div>';
    }).join('') || '<p class="empty">Sin cuentas</p>';
    var fl = '<div class="legend">' + ML.STAGES.filter(function(s){ return s[0] !== 'no_aplica'; }).map(function(s){ return '<span><i class="st-' + s[0] + '"></i>' + esc(s[1]) + '</span>'; }).join('') + '</div>';

    // Cuentas activas (Core o AI) sin ninguna tarea abierta
    var withTask = {}; o.forEach(function(x){ if(x.account_id) withTask[x.account_id] = 1; });
    var idle = ML.s.accounts.filter(function(a){
      if(!a.active || withTask[a.id]) return false;
      return ML.s.stages.some(function(s){ return s.account_id === a.id && ML.ACTIVE_STAGES.indexOf(s.stage) >= 0 && s.stage !== 'sin_contacto' || (s.account_id === a.id && s.stage === 'sin_contacto' && (s.vp === 'ai')); });
    });
    var idleH = idle.length ? idle.slice(0, 12).map(function(a){ return '<div class="it"><span class="t">' + esc(a.name) + '</span><span class="m">' + esc(a.am || 'sin AM') + '</span></div>'; }).join('') + (idle.length > 12 ? '<p class="muted">… y ' + (idle.length - 12) + ' más</p>' : '') : '<p class="empty">Todas las cuentas activas tienen una acción abierta ✓</p>';

    // Próximas
    var next = o.filter(function(x){ var u = ML.urgency(x); return u === 'over' || u === 'soon' || u === 'week'; }).sort(function(a, b){ return a.due < b.due ? -1 : 1; });
    var nextH = next.slice(0, 15).map(function(x){
      var u = ML.urgency(x);
      return '<div class="it"><span class="t">' + esc(x.title) + '<br><span class="m">' + esc([accName(x.account_id), x.vp ? ML.vpLabel(x.vp) : '', x.owner].filter(Boolean).join(' · ')) + '</span></span><span class="pill ' + u + '">' + ML.fmt(x.due) + ' · ' + ML.dueText(x) + '</span></div>';
    }).join('') + (next.length > 15 ? '<p class="muted">… y ' + (next.length - 15) + ' más (pestaña Tareas)</p>' : '') || '<p class="empty">Nada vence en los próximos 7 días</p>';

    return h + '<div class="grid cols">' +
      '<div class="panel"><h2>Vencen pronto</h2><div class="list">' + nextH + '</div></div>' +
      '<div class="panel"><h2>Carga por responsable (tareas abiertas)</h2>' + load + legend + '</div>' +
      '<div class="panel"><h2>Embudo por propuesta de valor (cuentas)</h2>' + funnel + fl + '</div>' +
      '<div class="panel"><h2>Cuentas sin ninguna acción abierta</h2><div class="list">' + idleH + '</div></div></div>';
  }

  // ======================= TAREAS =======================
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
  function visible(){
    var f = ML.ui.f, q = f.q.trim().toLowerCase();
    var list = ML.s.tasks.filter(function(t){
      if(!passQuick(t, ML.ui.quick)) return false;
      if(f.account.length && f.account.indexOf(t.account_id) < 0) return false;
      if(f.owner.length && f.owner.indexOf(t.owner || '__none') < 0) return false;
      if(f.vp.length && f.vp.indexOf(t.vp) < 0) return false;
      if(f.pilar.length && f.pilar.indexOf(t.pilar) < 0) return false;
      if(f.status.length && f.status.indexOf(t.status) < 0) return false;
      if(q && (t.title + ' ' + accName(t.account_id) + ' ' + (t.owner || '') + ' ' + (t.note || '') + ' ' + (t.scope_text || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var key = ML.ui.sort, dir = ML.ui.dir;
    var val = function(t){
      if(key === 'due') return t.due || (dir > 0 ? '9999' : '');
      if(key === 'account') return accName(t.account_id).toLowerCase() || '￿';
      if(key === 'priority') return { alta: 0, media: 1, baja: 2 }[t.priority];
      if(key === 'status') return ML.STATUS.map(function(s){ return s[0]; }).indexOf(t.status);
      return String(t[key] || '').toLowerCase() || '￿';
    };
    list.sort(function(a, b){ var x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * dir || a.id - b.id; });
    return list;
  }
  function groupKey(t){
    var g = ML.ui.group;
    if(g === 'owner') return t.owner || '(sin responsable)';
    if(g === 'account') return accName(t.account_id) || '(sin cuenta)';
    if(g === 'vp') return t.vp ? ML.vpLabel(t.vp) : '(sin VP)';
    return '';
  }
  function row(t){
    var u = ML.urgency(t), ro = '';
    var pil = (!t.account_id && !t.vp) ? '<span class="pill" title="Pilar">' + esc(ML.lab(ML.PILARES, t.pilar)) + '</span> ' : '';
    var r = '<tr class="u-' + u + '" data-id="' + t.id + '">' +
      '<td class="act editable"><input type="checkbox" data-f="done"' + (t.status === 'hecha' ? ' checked' : '') + ' title="Marcar hecha"></td>' +
      '<td class="editable">' + pil + '<input class="title" data-f="title" value="' + esc(t.title) + '"></td>' +
      '<td class="editable"><select data-f="account_id">' + accOpts(t.account_id, '—') + '</select></td>' +
      '<td class="editable"><select data-f="vp">' + vpOpts(t.vp, '—') + '</select></td>' +
      '<td class="editable"><select data-f="kind">' + opts(ML.KINDS, t.kind) + '</select></td>' +
      '<td class="editable"><select data-f="owner">' + peopleOpts(t.owner, '—') + '</select></td>' +
      '<td class="editable"><input type="date" data-f="due" value="' + esc(t.due || '') + '"> <span class="pill ' + u + '">' + esc(ML.dueText(t)) + '</span></td>' +
      '<td class="editable"><select data-f="status">' + opts(ML.STATUS, t.status) + '</select></td>' +
      '<td class="editable"><select data-f="priority">' + opts(ML.PRIOS, t.priority) + '</select></td>' +
      '<td class="act"><button class="btn sm" data-a="note" title="Nota">' + (t.note ? '📝' : '＋') + '</button> <button class="btn sm danger editable" data-a="del" title="Borrar">🗑</button></td></tr>';
    if(ML.ui.openNote === t.id){
      r += '<tr><td></td><td colspan="9" class="note editable"><textarea data-f="note" placeholder="Nota…">' + esc(t.note) + '</textarea></td></tr>';
    }
    return r;
  }
  function tasksView(){
    var f = ML.ui.f, list = visible();
    var th = function(k, l){ return '<th class="s" data-sort="' + k + '">' + l + (ML.ui.sort === k ? (ML.ui.dir > 0 ? ' ▲' : ' ▼') : '') + '</th>'; };
    var add = '<form class="add" id="addForm">' +
      '<input id="a-title" placeholder="Nueva tarea…" required>' +
      '<select id="a-acc">' + accOpts('', 'Cuenta') + '</select>' +
      '<select id="a-vp">' + vpOpts('', 'VP') + '</select>' +
      '<select id="a-kind">' + opts(ML.KINDS, 'otro') + '</select>' +
      '<select id="a-owner">' + peopleOpts('', 'Responsable') + '</select>' +
      '<input type="date" id="a-due" title="Fecha límite">' +
      '<button class="btn primary" type="submit">Añadir</button>' +
      '<select id="a-other" title="Si no es de cuenta ni de VP"><option value="">Otro: —</option><option value="partnership">Partnership</option><option value="marketing">Marketing</option></select></form>';
    var chips = '<div class="chips">' + QUICK.map(function(q){ return '<button data-q="' + q[0] + '" class="' + (ML.ui.quick === q[0] ? 'on' : '') + '">' + q[1] + '</button>'; }).join(' ') + '</div>';
    var fl = '<div class="filters">' + chips +
      ms('account', 'Todas las cuentas', ML.s.accounts.map(function(a){ return [a.id, a.name]; })) +
      ms('owner', 'Todos los responsables', [['__none', '(sin responsable)']].concat(ML.s.people.map(function(p){ return [p.name, p.name]; }))) +
      ms('vp', 'Todas las VP', ML.VPS.map(function(v){ return [v.k, v.label]; })) +
      ms('pilar', 'Todos los pilares', ML.PILARES) +
      ms('status', 'Todos los estados', ML.STATUS) +
      '<input data-flt="q" placeholder="Buscar…" value="' + esc(f.q) + '">' +
      '<select id="grp">' + opts([['', 'Sin agrupar'], ['owner', 'Agrupar: responsable'], ['account', 'Agrupar: cuenta'], ['vp', 'Agrupar: VP']], ML.ui.group) + '</select>' +
      '<button class="btn sm" id="clr">Limpiar</button><span class="muted">' + list.length + ' tareas</span>' +
      '<span style="flex:1"></span><button class="btn sm editable" id="imp">⬆ Importar histórico</button><input type="file" id="impf" accept="application/json" hidden><button class="btn sm" id="exp">⬇ Exportar CSV</button></div>';
    var body = '', last = null;
    list.forEach(function(t){
      if(ML.ui.group){ var g = groupKey(t); if(g !== last){ body += '<tr class="grp"><td colspan="10">' + esc(g) + '</td></tr>'; last = g; } }
      body += row(t);
    });
    if(!list.length) body = '<tr><td colspan="10" class="empty">No hay tareas con este filtro.</td></tr>';
    return add + fl + '<div class="tablewrap"><table><thead><tr><th></th>' + th('title', 'Tarea') + th('account', 'Cuenta') + '<th>VP</th><th>Tipo</th>' + th('owner', 'Responsable') + th('due', 'Fecha límite') + th('status', 'Estado') + th('priority', 'Prior.') + '<th></th></tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function csvCell(v){ v = String(v == null ? '' : v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function exportCsv(){
    var rows = [['Tarea', 'Cuenta', 'VP', 'Pilar', 'Tipo', 'Responsable', 'Fecha límite', 'Estado', 'Prioridad', 'Nota']];
    visible().forEach(function(t){ rows.push([t.title, accName(t.account_id), ML.vpLabel(t.vp), ML.lab(ML.PILARES, t.pilar), ML.lab(ML.KINDS, t.kind), t.owner || '', t.due || '', ML.lab(ML.STATUS, t.status), t.priority, t.note]); });
    var blob = new Blob(['﻿' + rows.map(function(r){ return r.map(csvCell).join(';'); }).join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tareas-' + ML.today() + '.csv'; document.body.appendChild(a); a.click(); a.remove();
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
      await ML.addTask({ title: title, account_id: acc, vp: vp, pilar: acc ? 'clientes' : vp ? 'vp' : (other || 'clientes'), kind: v.querySelector('#a-kind').value, owner: v.querySelector('#a-owner').value, due: v.querySelector('#a-due').value });
      ML.toast('Tarea añadida'); ML.rerender();
      var t = document.getElementById('a-title'); if(t) t.focus();
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
    v.querySelector('#exp').onclick = exportCsv;
    var impf = v.querySelector('#impf');
    v.querySelector('#imp').onclick = function(){ impf.click(); };
    impf.onchange = async function(){
      var file = impf.files[0]; if(!file) return;
      try{
        var data = JSON.parse(await file.text()); if(!Array.isArray(data)) throw new Error('El archivo debe contener una lista de tareas');
        if(!confirm('Importar ' + data.length + ' tareas del histórico?')) return;
        var n = await ML.importOld(data); ML.toast(n + ' tareas importadas'); ML.rerender();
      }catch(err){ ML.toast('Importación fallida: ' + err.message, true); }
      impf.value = '';
    };
    v.querySelectorAll('th[data-sort]').forEach(function(h){ h.onclick = function(){ var k = h.dataset.sort; if(ui.sort === k) ui.dir = -ui.dir; else { ui.sort = k; ui.dir = 1; } ML.rerender(); }; });
    v.querySelector('tbody').addEventListener('change', async function(e){
      var el = e.target, tr = el.closest('tr'), id = tr && +tr.dataset.id, f = el.dataset.f;
      if(!id || !f) return;
      var patch = {};
      if(f === 'done') patch.status = el.checked ? 'hecha' : 'pendiente';
      else if(f === 'account_id' || f === 'vp'){
        patch[f] = el.value || null;
        var t = ML.task(id), acc = f === 'account_id' ? el.value : t.account_id, vp = f === 'vp' ? el.value : t.vp;
        if(t.pilar === 'clientes' || t.pilar === 'vp') patch.pilar = acc ? 'clientes' : vp ? 'vp' : 'clientes';
        if(f === 'account_id' && el.value && !t.owner){ var a = ML.account(el.value); if(a && a.am) patch.owner = a.am; }
      }
      else if(f === 'owner') patch.owner = el.value || null;
      else if(f === 'due') patch.due = el.value || null;
      else if(f === 'title'){ if(!el.value.trim()){ ML.rerender(); return; } patch.title = el.value.trim(); }
      else patch[f] = el.value;
      await ML.updateTask(id, patch); ML.rerender();
    });
    v.querySelector('tbody').addEventListener('click', async function(e){
      var b = e.target.closest('[data-a]'); if(!b) return;
      var id = +b.closest('tr').dataset.id;
      if(b.dataset.a === 'note'){ ui.openNote = ui.openNote === id ? null : id; ML.rerender(); }
      if(b.dataset.a === 'del' && confirm('¿Borrar esta tarea?')){ await ML.deleteTask(id); ML.rerender(); }
    });
  }

  // ======================= CUENTAS =======================
  function accountsView(){
    var ui = ML.ui, f = ui.accF || (ui.accF = { am: '', q: '', vp: '', stage: '' }), q = f.q.trim().toLowerCase();
    var list = ML.s.accounts.filter(function(a){ if(f.am && a.am !== f.am) return false;
      if(q && a.name.toLowerCase().indexOf(q) < 0) return false;
      if(f.vp || f.stage){
        return ML.s.stages.some(function(s){ return s.account_id === a.id && (!f.vp || s.vp === f.vp) && (f.stage ? s.stage === f.stage : s.stage !== 'no_aplica'); });
      }
      return true; });
    var opn = {}; openTasks().forEach(function(t){ if(t.account_id) opn[t.account_id] = (opn[t.account_id] || 0) + 1; });
    var head = '<div class="filters"><select id="af-am">' + peopleOpts(f.am, 'Todos los AM') + '</select><input id="af-q" placeholder="Buscar cuenta…" value="' + esc(f.q) + '">' +
      '<select id="af-vp">' + vpOpts(f.vp, 'Todas las VP') + '</select><select id="af-st">' + opts(ML.STAGES, f.stage, 'Todas las etapas') + '</select><button class="btn sm" id="af-clr">Limpiar</button>' +
      '<span class="muted">' + list.length + ' cuentas</span><span style="flex:1"></span>' +
      '<button class="btn sm editable" id="add-acc">+ Cuenta</button><button class="btn sm editable" id="add-per">+ Responsable</button></div>';
    var th = '<thead><tr><th>Cuenta</th><th>AM</th>' + ML.VPS.map(function(v){ return '<th>' + esc(v.label) + '</th>'; }).join('') + '<th>Tareas abiertas</th><th></th></tr></thead>';
    var body = list.map(function(a){
      var tds = ML.VPS.map(function(v){
        var s = ML.stageOf(a.id, v.k), st = s ? s.stage : 'no_aplica';
        return '<td class="editable"><select class="stsel st-' + st + '" data-vp="' + v.k + '">' + opts(ML.STAGES, st) + '</select></td>';
      }).join('');
      var r = '<tr data-acc="' + esc(a.id) + '"><td><b>' + esc(a.name) + '</b></td><td class="editable"><select data-am>' + peopleOpts(a.am, '—') + '</select></td>' + tds +
        '<td>' + (opn[a.id] ? '<a href="#" data-go="' + esc(a.id) + '">' + opn[a.id] + '</a>' : '<span class="muted">0</span>') + '</td>' +
        '<td class="act"><button class="btn sm" data-detail>' + (ui.openAcc === a.id ? '▲' : '▼') + '</button></td></tr>';
      if(ui.openAcc === a.id){
        r += '<tr><td colspan="' + (ML.VPS.length + 4) + '" class="note editable"><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">' +
          ML.VPS.map(function(v){ var s = ML.stageOf(a.id, v.k) || {}; return '<div><b>' + esc(v.label) + '</b><br><textarea data-note="' + v.k + '" placeholder="Notas (caso de uso, motivo de aparcado…)">' + esc(s.note) + '</textarea><br><label class="muted">Revisar el <input type="date" data-rev="' + v.k + '" value="' + esc(s.review_date || '') + '"></label></div>'; }).join('') +
          '<div><b>Nota de la cuenta</b><br><textarea data-accnote>' + esc(a.note) + '</textarea><br><button class="btn sm danger" data-delacc>Borrar cuenta</button></div></div></td></tr>';
      }
      return r;
    }).join('') || '<tr><td colspan="' + (ML.VPS.length + 4) + '" class="empty">Sin cuentas</td></tr>';
    return head + '<div class="tablewrap"><table>' + th + '<tbody>' + body + '</tbody></table></div>';
  }
  function bindAccounts(v){
    var ui = ML.ui;
    v.querySelector('#af-am').onchange = function(e){ ui.accF.am = e.target.value; ML.rerender(); };
    v.querySelector('#af-vp').onchange = function(e){ ui.accF.vp = e.target.value; ML.rerender(); };
    v.querySelector('#af-st').onchange = function(e){ ui.accF.stage = e.target.value; ML.rerender(); };
    v.querySelector('#af-clr').onclick = function(){ ui.accF = { am: '', q: '', vp: '', stage: '' }; ML.rerender(); };
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
    });
    tb.addEventListener('click', async function(e){
      var b = e.target.closest('[data-detail],[data-delacc]'); if(!b) return;
      var tr = b.closest('tr'); if(!tr.dataset.acc) tr = tr.previousElementSibling;
      var id = tr.dataset.acc;
      if(b.hasAttribute('data-detail')){ ui.openAcc = ui.openAcc === id ? null : id; ML.rerender(); }
      else if(confirm('¿Borrar la cuenta y sus etapas? Sus tareas se conservarán sin cuenta.')){ await ML.deleteAccount(id); ui.openAcc = null; ML.rerender(); }
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
    } else if(ui.tab === 'tasks'){ v.innerHTML = tasksView(); bindTasks(v); }
    else { v.innerHTML = accountsView(); bindAccounts(v); }
  };
  ML.rerender = ML.render;
  document.addEventListener('click', function(e){
    if(ML.ui.msOpen && !e.target.closest('.ms')){ ML.ui.msOpen = null; ML.render(); }
  });
  ML.setTab = function(t){ ML.ui.tab = t; ML.render(); window.scrollTo(0, 0); };

  // Recordatorio al abrir: vencidas y próximas (una vez por sesión del navegador)
  ML.showReminders = function(){
    try{ if(sessionStorage.getItem('ml_rem') === ML.today()) return; }catch(e){}
    var l = openTasks().filter(function(t){ var u = ML.urgency(t); return u === 'over' || u === 'soon' || u === 'week'; }).sort(function(a, b){ return a.due < b.due ? -1 : 1; });
    if(!l.length) return;
    var m = $('modal');
    m.innerHTML = '<div class="box"><h2>Recordatorio · ' + l.length + ' tarea' + (l.length === 1 ? '' : 's') + ' requieren atención</h2><div class="list">' +
      l.slice(0, 20).map(function(t){ var u = ML.urgency(t); return '<div class="it"><span class="t">' + esc(t.title) + '<br><span class="m">' + esc([accName(t.account_id), t.owner].filter(Boolean).join(' · ')) + '</span></span><span class="pill ' + u + '">' + ML.fmt(t.due) + ' · ' + ML.dueText(t) + '</span></div>'; }).join('') +
      (l.length > 20 ? '<p class="muted">… y ' + (l.length - 20) + ' más</p>' : '') + '</div><p style="text-align:right"><button class="btn" id="rem-x">Cerrar</button> <button class="btn primary" id="rem-go">Ver tareas</button></p></div>';
    m.hidden = false;
    var close = function(){ m.hidden = true; try{ sessionStorage.setItem('ml_rem', ML.today()); }catch(e){} };
    $('rem-x').onclick = close; $('rem-go').onclick = function(){ close(); ML.ui.quick = 'semana'; ML.setTab('tasks'); };
  };
})();
