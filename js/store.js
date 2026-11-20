/* Datos, constantes y operaciones contra Supabase. Todo lo que cambia entre versiones (listas, etapas, estados) vive AQUÍ. */
(function(){
  'use strict';
  var ML = window.ML = window.ML || {};

  // ---------- Listas de valores: valores por defecto; la fuente real es la tabla ml_lists (editable en Configuración) ----------
  ML.DEFAULT_LISTS = {
    vp: [['core', 'Core Evolution'], ['ai', 'Insurance AI'], ['everywhere', 'Everywhere'], ['regtech', 'RegTech']],
    stage: [['sin_contacto', 'Sin contacto'], ['solicitar_reunion', 'Solicitar fecha de reunión'], ['reunion', 'Reunión'], ['vp_presentada', 'VP presentada'],
            ['propuesta', 'Propuesta'], ['ganada', 'Ganada'], ['perdida', 'Perdida'], ['aparcada', 'Aparcada'], ['no_aplica', 'No aplica']],
    status: [['pendiente', 'Pendiente'], ['en_curso', 'En curso'], ['bloqueada', 'Bloqueada'], ['hecha', 'Hecha']],
    kind: [['reunion', 'Reunión'], ['presentar_vp', 'Presentar VP'], ['propuesta', 'Propuesta'], ['otro', 'Otro']],
    pilar: [['vp', 'VP'], ['clientes', 'Clientes'], ['partnership', 'Partnership'], ['marketing', 'Marketing']],
    priority: [['alta', 'Alta'], ['media', 'Media'], ['baja', 'Baja']]
  };
  // Valores que la lógica de la app necesita: se pueden renombrar y cambiar de color, pero no borrar ni desactivar
  ML.SYSTEM = { vp: [], stage: ['sin_contacto', 'no_aplica'], status: ['pendiente', 'hecha'], kind: ['otro'], pilar: ['vp', 'clientes'], priority: ['media'] };
  ML.LIST_TITLES = { vp: 'Propuestas de valor (VP)', stage: 'Etapas de la cuenta', status: 'Estados de tarea', kind: 'Tipos de tarea', pilar: 'Pilares', priority: 'Prioridades' };
  ML.LIST_FIELD = { status: 'status', kind: 'kind', pilar: 'pilar', priority: 'priority' };
  var PALETTE = ['#c9a227', '#6aa5e6', '#8e7cc3', '#e08a3c', '#2e8b57', '#c0392b', '#9aa3b5', '#2a9d8f', '#d6559b', '#7a8f3a'];
  var NOT_ADVANCE = ['no_aplica', 'aparcada', 'perdida'];

  ML.s = { people: [], accounts: [], stages: [], tasks: [], lists: [] };
  ML.listsOk = false;

  ML.applyLists = function(rows){
    var src = {};
    Object.keys(ML.DEFAULT_LISTS).forEach(function(k){ src[k] = []; });
    (rows || []).forEach(function(r){ if(src[r.kind]) src[r.kind].push(r); });
    Object.keys(src).forEach(function(k){
      if(!src[k].length){
        src[k] = ML.DEFAULT_LISTS[k].map(function(d, i){ return { kind: k, key: d[0], label: d[1], sort: i + 1, active: true, color: '', system: ML.SYSTEM[k].indexOf(d[0]) >= 0 }; });
      }
      src[k].sort(function(a, b){ return (a.sort - b.sort) || (a.key < b.key ? -1 : 1); });
    });
    ML.rows = src;
    var act = function(k){ return src[k].filter(function(r){ return r.active || ML.SYSTEM[k].indexOf(r.key) >= 0; }); };
    var pairs = function(k){ var a = act(k).map(function(r){ return [r.key, r.label]; }); a._kind = k; return a; };
    ML.VPS = act('vp').map(function(r){ return { k: r.key, label: r.label }; });
    ML.STAGES = pairs('stage'); ML.STATUS = pairs('status'); ML.KINDS = pairs('kind'); ML.PILARES = pairs('pilar'); ML.PRIOS = pairs('priority');
    ML.ACTIVE_STAGES = ML.STAGES.map(function(x){ return x[0]; }).filter(function(k){ return NOT_ADVANCE.indexOf(k) < 0 && k !== 'ganada'; });
  };
  ML.applyLists(null);
  ML.stageColor = function(k){ var r = (ML.rows.stage || []).filter(function(x){ return x.key === k; })[0]; return r && r.color ? r.color : ''; };

  // ---------- Utilidades ----------
  ML.esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  ML.lab = function(list, k){
    for(var i = 0; i < list.length; i++){ if(list[i][0] === k) return list[i][1]; }
    var rows = (list._kind && ML.rows[list._kind]) || [];
    for(var j = 0; j < rows.length; j++){ if(rows[j].key === k) return rows[j].label; }
    return k || '';
  };
  ML.vpLabel = function(k){ var r = ML.rows.vp.filter(function(x){ return x.key === k; })[0]; return r ? r.label : (k || ''); };
  ML.bestStage = function(accountId){
    var best = -1, ord = ML.STAGES.map(function(x){ return x[0]; });
    ML.s.stages.forEach(function(s){ if(s.account_id === accountId && NOT_ADVANCE.indexOf(s.stage) < 0){ var i = ord.indexOf(s.stage); if(i > best) best = i; } });
    return best < 0 ? '' : ord[best];
  };
  function p2(n){ return (n < 10 ? '0' : '') + n; }
  ML.today = function(){ var d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  ML.days = function(iso){
    if(!iso) return null;
    var a = iso.split('-'), b = ML.today().split('-');
    return Math.round((Date.UTC(+a[0], +a[1] - 1, +a[2]) - Date.UTC(+b[0], +b[1] - 1, +b[2])) / 864e5);
  };
  ML.fmt = function(iso){ if(!iso) return '—'; var a = iso.split('-'); return a[2] + '/' + a[1] + '/' + a[0]; };
  ML.isOpen = function(t){ return t.status !== 'hecha'; };
  // Urgencia por días hasta la fecha límite: vencida / ≤3 días / ≤7 días / resto
  ML.urgency = function(t){
    if(t.status === 'hecha') return 'done';
    var d = ML.days(t.due);
    if(d === null) return 'none';
    if(d < 0) return 'over';
    if(d <= 3) return 'soon';
    if(d <= 7) return 'week';
    return 'later';
  };
  ML.dueText = function(t){
    var d = ML.days(t.due);
    if(t.status === 'hecha' || d === null) return '';
    if(d < 0) return 'hace ' + (-d) + (d === -1 ? ' día' : ' días');
    if(d === 0) return 'hoy';
    if(d === 1) return 'mañana';
    return 'en ' + d + ' días';
  };
  ML.slug = function(name){
    return String(name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'cuenta';
  };

  // ---------- Estado en memoria ----------
  ML.account = function(id){ for(var i = 0; i < ML.s.accounts.length; i++){ if(ML.s.accounts[i].id === id) return ML.s.accounts[i]; } return null; };
  ML.task = function(id){ for(var i = 0; i < ML.s.tasks.length; i++){ if(ML.s.tasks[i].id === id) return ML.s.tasks[i]; } return null; };
  ML.stageOf = function(accountId, vp){
    for(var i = 0; i < ML.s.stages.length; i++){ var s = ML.s.stages[i]; if(s.account_id === accountId && s.vp === vp) return s; }
    return null;
  };

  ML.toast = function(msg, err){
    var box = document.getElementById('toasts'); if(!box) return;
    var el = document.createElement('div'); el.className = 'toast' + (err ? ' err' : ''); el.textContent = msg;
    box.appendChild(el); setTimeout(function(){ el.remove(); }, err ? 7000 : 2500);
  };
  async function fail(e){
    ML.toast('No se pudo guardar: ' + ((e && e.message) || 'error'), true);
    await ML.load(); if(ML.rerender) ML.rerender();
  }

  ML.load = async function(){
    var q = function(t, o){ var r = ML.sb.from(t).select('*'); return o ? r.order(o) : r; };
    var res = await Promise.all([q('ml_people', 'sort'), q('ml_accounts', 'name'), q('ml_stages'), q('ml_tasks', 'id'), q('ml_lists', 'sort')]);
    for(var i = 0; i < 4; i++){ if(res[i].error){ ML.toast('Error al leer datos: ' + res[i].error.message, true); return false; } }
    ML.s.people = res[0].data; ML.s.accounts = res[1].data; ML.s.stages = res[2].data; ML.s.tasks = res[3].data;
    ML.listsOk = !res[4].error && !!res[4].data && res[4].data.length > 0;
    ML.s.lists = ML.listsOk ? res[4].data : [];
    ML.applyLists(ML.s.lists);
    ML.loadedAt = Date.now();
    return true;
  };

  // ---------- Tareas ----------
  ML.addTask = async function(f){
    var row = {
      title: f.title, account_id: f.account_id || null, vp: f.vp || null, pilar: f.pilar || 'clientes', scope_text: f.scope_text || '',
      kind: f.kind || 'otro', owner: f.owner || null, due: f.due || null, status: 'pendiente', priority: f.priority || 'media', note: f.note || '', source: f.source || ''
    };
    var r = await ML.sb.from('ml_tasks').insert(row).select().single();
    if(r.error){ await fail(r.error); return null; }
    ML.s.tasks.push(r.data); return r.data;
  };
  ML.updateTask = async function(id, patch){
    var t = ML.task(id); if(!t) return false;
    if('status' in patch) patch.done_at = patch.status === 'hecha' ? new Date().toISOString() : null;
    Object.keys(patch).forEach(function(k){ t[k] = patch[k]; });
    var r = await ML.sb.from('ml_tasks').update(patch).eq('id', id);
    if(r.error){ await fail(r.error); return false; }
    return true;
  };
  ML.deleteTask = async function(id){
    ML.s.tasks = ML.s.tasks.filter(function(t){ return t.id !== id; });
    var r = await ML.sb.from('ml_tasks').delete().eq('id', id);
    if(r.error){ await fail(r.error); return false; }
    return true;
  };

  // ---------- Etapas por cuenta y VP ----------
  ML.setStage = async function(accountId, vp, patch){
    var s = ML.stageOf(accountId, vp);
    if(!s){ s = { account_id: accountId, vp: vp, stage: 'sin_contacto', note: '', review_date: null }; ML.s.stages.push(s); }
    Object.keys(patch).forEach(function(k){ s[k] = patch[k]; });
    var r = await ML.sb.from('ml_stages').upsert({ account_id: accountId, vp: vp, stage: s.stage, note: s.note || '', review_date: s.review_date || null }, { onConflict: 'account_id,vp' });
    if(r.error){ await fail(r.error); return false; }
    return true;
  };

  // ---------- Cuentas y responsables ----------
  ML.addAccount = async function(name, am){
    var base = ML.slug(name), id = base, n = 2;
    while(ML.account(id)){ id = base + '-' + (n++); }
    var r = await ML.sb.from('ml_accounts').insert({ id: id, name: name, am: am || null }).select().single();
    if(r.error){ await fail(r.error); return null; }
    ML.s.accounts.push(r.data);
    ML.s.accounts.sort(function(a, b){ return a.name.localeCompare(b.name, 'es'); });
    var rows = ML.VPS.map(function(v){ return { account_id: id, vp: v.k, stage: (v.k === 'core' || v.k === 'ai') ? 'sin_contacto' : 'no_aplica', note: '' }; });
    var r2 = await ML.sb.from('ml_stages').upsert(rows, { onConflict: 'account_id,vp' });
    if(r2.error){ await fail(r2.error); return null; }
    rows.forEach(function(x){ ML.s.stages.push(x); });
    return r.data;
  };
  ML.updateAccount = async function(id, patch){
    var a = ML.account(id); if(!a) return false;
    Object.keys(patch).forEach(function(k){ a[k] = patch[k]; });
    var r = await ML.sb.from('ml_accounts').update(patch).eq('id', id);
    if(r.error){ await fail(r.error); return false; }
    return true;
  };
  ML.deleteAccount = async function(id){
    var r = await ML.sb.from('ml_accounts').delete().eq('id', id);
    if(r.error){ await fail(r.error); return false; }
    ML.s.accounts = ML.s.accounts.filter(function(a){ return a.id !== id; });
    ML.s.stages = ML.s.stages.filter(function(s){ return s.account_id !== id; });
    ML.s.tasks.forEach(function(t){ if(t.account_id === id) t.account_id = null; });
    return true;
  };
  ML.addPerson = async function(name){
    var sort = ML.s.people.length ? Math.max.apply(null, ML.s.people.map(function(p){ return p.sort || 0; })) + 1 : 1;
    var r = await ML.sb.from('ml_people').insert({ name: name, sort: sort }).select().single();
    if(r.error){ await fail(r.error); return null; }
    ML.s.people.push(r.data); return r.data;
  };

  // ---------- Configuración: listas de valores, responsables y cuentas ----------
  function usedBy(kind, key){
    if(kind === 'vp') return ML.s.tasks.filter(function(t){ return t.vp === key; }).length + ML.s.stages.filter(function(x){ return x.vp === key && x.stage !== 'no_aplica'; }).length;
    if(kind === 'stage') return ML.s.stages.filter(function(x){ return x.stage === key; }).length;
    var f = ML.LIST_FIELD[kind]; return ML.s.tasks.filter(function(t){ return t[f] === key; }).length;
  }
  ML.listUsed = usedBy;
  ML.listAdd = async function(kind, label){
    label = String(label || '').trim(); if(!label) return null;
    var rows = ML.rows[kind], base = ML.slug(label).replace(/-/g, '_'), key = base, n = 2;
    while(rows.some(function(r){ return r.key === key; })) key = base + '_' + (n++);
    var sort = Math.max.apply(null, rows.map(function(r){ return r.sort; }).concat([0])) + 1;
    var row = { kind: kind, key: key, label: label, sort: sort, active: true, color: kind === 'stage' ? PALETTE[rows.length % PALETTE.length] : '', system: false };
    if(!ML.listsOk){ ML.toast('Falta ejecutar migration_v3.sql en Supabase para poder editar las listas', true); return null; }
    var r = await ML.sb.from('ml_lists').insert(row).select().single();
    if(r.error){ await fail(r.error); return null; }
    ML.s.lists.push(r.data); ML.applyLists(ML.s.lists); return r.data;
  };
  ML.listUpdate = async function(kind, key, patch){
    if(!ML.listsOk){ ML.toast('Falta ejecutar migration_v3.sql en Supabase', true); return false; }
    var row = ML.s.lists.filter(function(r){ return r.kind === kind && r.key === key; })[0]; if(!row) return false;
    if(patch.active === false && ML.SYSTEM[kind].indexOf(key) >= 0){ ML.toast('Es un valor del sistema: no se puede desactivar', true); return false; }
    Object.keys(patch).forEach(function(k){ row[k] = patch[k]; }); ML.applyLists(ML.s.lists);
    var r = await ML.sb.from('ml_lists').update(patch).eq('kind', kind).eq('key', key);
    if(r.error){ await fail(r.error); return false; }
    return true;
  };
  ML.listMove = async function(kind, key, dir){
    var rows = ML.rows[kind], i = rows.map(function(r){ return r.key; }).indexOf(key), j = i + dir;
    if(i < 0 || j < 0 || j >= rows.length) return false;
    var a = rows[i], b = rows[j], sa = a.sort, sb = b.sort;
    if(sa === sb){ sb = sa + dir; }
    var ok1 = await ML.listUpdate(kind, a.key, { sort: sb }), ok2 = await ML.listUpdate(kind, b.key, { sort: sa });
    return ok1 && ok2;
  };
  ML.listDelete = async function(kind, key){
    if(ML.SYSTEM[kind].indexOf(key) >= 0){ ML.toast('Es un valor del sistema: se puede renombrar pero no borrar', true); return false; }
    var n = usedBy(kind, key);
    if(n){ ML.toast('No se puede borrar: está en uso (' + n + '). Desactívalo para ocultarlo.', true); return false; }
    var r = await ML.sb.from('ml_lists').delete().eq('kind', kind).eq('key', key);
    if(r.error){ await fail(r.error); return false; }
    if(kind === 'vp'){ var r2 = await ML.sb.from('ml_stages').delete().eq('vp', key); if(r2.error){ await fail(r2.error); return false; } ML.s.stages = ML.s.stages.filter(function(x){ return x.vp !== key; }); }
    ML.s.lists = ML.s.lists.filter(function(x){ return !(x.kind === kind && x.key === key); }); ML.applyLists(ML.s.lists);
    return true;
  };

  ML.renamePerson = async function(oldName, newName){
    newName = String(newName || '').trim();
    if(!newName || newName === oldName) return false;
    if(ML.s.people.some(function(p){ return p.name === newName; })){ ML.toast('Ya existe un responsable con ese nombre', true); return false; }
    var r = await ML.sb.from('ml_people').update({ name: newName }).eq('name', oldName);
    if(r.error){ await fail(r.error); return false; }
    ML.s.people.forEach(function(p){ if(p.name === oldName) p.name = newName; });
    ML.s.accounts.forEach(function(a){ if(a.am === oldName) a.am = newName; });
    ML.s.tasks.forEach(function(t){ if(t.owner === oldName) t.owner = newName; });
    return true;
  };
  ML.updatePerson = async function(name, patch){
    var p = ML.s.people.filter(function(x){ return x.name === name; })[0]; if(!p) return false;
    Object.keys(patch).forEach(function(k){ p[k] = patch[k]; });
    var r = await ML.sb.from('ml_people').update(patch).eq('name', name);
    if(r.error){ await fail(r.error); return false; }
    return true;
  };
  ML.movePerson = async function(name, dir){
    var arr = ML.s.people.slice().sort(function(a, b){ return (a.sort - b.sort) || (a.name < b.name ? -1 : 1); });
    var i = arr.map(function(p){ return p.name; }).indexOf(name), j = i + dir;
    if(i < 0 || j < 0 || j >= arr.length) return false;
    var a = arr[i], b = arr[j], sa = a.sort, sb = b.sort; if(sa === sb) sb = sa + dir;
    var ok1 = await ML.updatePerson(a.name, { sort: sb }), ok2 = await ML.updatePerson(b.name, { sort: sa });
    ML.s.people.sort(function(x, y){ return (x.sort - y.sort) || (x.name < y.name ? -1 : 1); });
    return ok1 && ok2;
  };
  ML.deletePerson = async function(name){
    var r = await ML.sb.from('ml_people').delete().eq('name', name);
    if(r.error){ await fail(r.error); return false; }
    ML.s.people = ML.s.people.filter(function(p){ return p.name !== name; });
    ML.s.accounts.forEach(function(a){ if(a.am === name) a.am = null; });
    ML.s.tasks.forEach(function(t){ if(t.owner === name) t.owner = null; });
    return true;
  };

  // ---------- Importar el JSON del listado antiguo (botón "Exportar histórico" del artefacto) ----------
  var OLD_STATUS = { 'pendiente': 'pendiente', 'en-curso': 'en_curso', 'bloqueada': 'bloqueada', 'retrasada': 'en_curso', 'hecho': 'hecha' };
  var OLD_VP = { 'Insurance Core Evolution': 'core', 'Insurance AI': 'ai', 'Insurance Everywhere': 'everywhere', 'Insurance RegTech': 'regtech' };
  var OK_KIND = ['reunion', 'presentar_vp', 'propuesta', 'otro'], OK_VP = ['core', 'ai', 'everywhere', 'regtech'], OK_PRIO = ['alta', 'media', 'baja'];
  // Acepta dos formatos: el del agente de Copilot {title, account, vp, kind, owner, due, priority, note}
  // y el del histórico antiguo {text, end, status, priority, pilar, scope, am}. Devuelve {n, skipped}.
  ML.importOld = async function(arr){
    var n = 0, skipped = 0, byName = {}, people = {}, titles = {};
    ML.s.accounts.forEach(function(a){ byName[a.name.toLowerCase()] = a; });
    ML.s.people.forEach(function(p){ people[p.name] = true; });
    ML.s.tasks.forEach(function(t){ titles[String(t.title).trim().toLowerCase()] = true; });
    for(var i = 0; i < arr.length; i++){
      var o = arr[i]; if(!o) continue;
      var f;
      if(o.title){
        var acc = o.account ? byName[String(o.account).toLowerCase()] : null, note = o.note || '';
        var owner = o.owner || '';
        if(owner && !people[owner]){ note = (note ? note + ' · ' : '') + 'Responsable propuesto: ' + owner; owner = ''; }
        if(o.account && !acc) note = (note ? note + ' · ' : '') + 'Cuenta no reconocida: ' + o.account;
        var vp = OK_VP.indexOf(o.vp) >= 0 ? o.vp : null;
        f = { title: String(o.title).trim(), account_id: acc ? acc.id : null, vp: vp, pilar: acc ? 'clientes' : vp ? 'vp' : 'clientes',
              kind: OK_KIND.indexOf(o.kind) >= 0 ? o.kind : 'otro', owner: owner, due: /^\d{4}-\d{2}-\d{2}$/.test(o.due || '') ? o.due : null,
              priority: OK_PRIO.indexOf(o.priority) >= 0 ? o.priority : 'media', note: note, source: 'agente', status: 'pendiente' };
      } else if(o.text){
        var pilar = o.pilar || 'vp', acc2 = null, vp2 = null, scope = '';
        if(pilar === 'clientes' && o.scope){ acc2 = byName[String(o.scope).toLowerCase()] || null; if(!acc2) scope = o.scope; }
        else if(pilar === 'vp' && o.scope){ vp2 = OLD_VP[o.scope] || null; if(!vp2) scope = o.scope; }
        else if(o.scope){ scope = o.scope; }
        var owner2 = o.am || o.owner || '', note2 = '';
        if(owner2 && !people[owner2]){ note2 = 'Responsable original: ' + owner2; owner2 = ''; }
        var due = o.end || '';
        if(o.recurring && Array.isArray(o.recurDates)){
          var t = ML.today(); var next = o.recurDates.slice().sort().filter(function(d){ return d >= t; })[0];
          due = next || o.recurDates.slice().sort().pop() || due; note2 = (note2 ? note2 + ' · ' : '') + 'Recurrente (semanal), repetir a mano';
        }
        f = { title: o.text, account_id: acc2 ? acc2.id : null, vp: vp2, pilar: pilar, scope_text: scope, kind: 'otro', owner: owner2, due: due || null,
              priority: OK_PRIO.indexOf(o.priority) >= 0 ? o.priority : 'media', note: note2, source: 'importado', status: OLD_STATUS[o.status] || 'pendiente' };
      } else continue;
      if(!f.title) continue;
      if(titles[f.title.toLowerCase()]){ skipped++; continue; }
      var st = f.status; delete f.status;
      var added = await ML.addTask(f);
      if(added){ titles[f.title.toLowerCase()] = true; if(st !== 'pendiente') await ML.updateTask(added.id, { status: st }); n++; }
    }
    return { n: n, skipped: skipped };
  };
})();
