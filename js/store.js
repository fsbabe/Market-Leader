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

  // Orden de los desplegables: alfabético o manual (se recuerda en este navegador). Por defecto alfabético salvo
  // etapas, estados y prioridades, donde el orden tiene significado (flujo / gravedad).
  var ALPHA_DEFAULT = { vp: 1, pilar: 1, kind: 1, people: 1 };
  ML.sortMode = function(kind){ try{ var v = localStorage.getItem('ml_sort_' + kind); if(v === 'alpha' || v === 'manual') return v; }catch(e){} return ALPHA_DEFAULT[kind] ? 'alpha' : 'manual'; };
  ML.setSortMode = function(kind, mode){ try{ localStorage.setItem('ml_sort_' + kind, mode); }catch(e){} if(kind === 'people') ML.resort(); else ML.applyLists(ML.s.lists); };
  var byText = function(f){ return function(a, b){ return String(f(a)).localeCompare(String(f(b)), 'es', { sensitivity: 'base' }); }; };
  ML.resort = function(){
    ML.s.accounts.sort(byText(function(a){ return a.name; }));
    if(ML.sortMode('people') === 'alpha') ML.s.people.sort(byText(function(p){ return p.name; }));
    else ML.s.people.sort(function(a, b){ return (a.sort - b.sort) || (a.name < b.name ? -1 : 1); });
  };

  // Colores de los pilares (editables en Configuración; estos son los valores por defecto)
  ML.PILAR_COLORS = { vp: '#F5F340', partnership: '#92A0CC', marketing: '#DA1984', clientes: '#232D4B' };
  ML.STATUS_COLORS = { pendiente: '#F28C28', en_curso: '#2F7FD1', bloqueada: '#D64545', hecha: '#2E9E5B' };
  ML.PRIO_COLORS = { alta: '#D64545', media: '#F28C28', baja: '#2E9E5B' };
  var DEFAULT_COLORS = { pilar: ML.PILAR_COLORS, status: ML.STATUS_COLORS, priority: ML.PRIO_COLORS };
  // Color de un valor de lista: el elegido en Configuración o, si no hay, el de por defecto
  ML.listColor = function(kind, k){ var r = (ML.rows[kind] || []).filter(function(x){ return x.key === k; })[0]; return (r && r.color) || (DEFAULT_COLORS[kind] && DEFAULT_COLORS[kind][k]) || ''; };
  ML.pilarColor = function(k){ return ML.listColor('pilar', k) || '#9aa3b5'; };
  // Estilo "pastilla" (fondo + texto legible) para un valor de lista
  ML.pillStyle = function(kind, k){ var c = ML.listColor(kind, k) || '#9aa3b5'; return 'background:' + c + ';color:' + ML.textOn(c); };
  ML.textOn = function(hex){
    var h = String(hex || '').replace('#', ''); if(h.length === 3) h = h.replace(/./g, '$&$&');
    var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#1d2433' : '#ffffff';
  };
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
    ML.stageOrder = src.stage.map(function(r){ return r.key; });   // orden lógico del embudo (siempre el manual)
    Object.keys(src).forEach(function(k){ if(ML.sortMode(k) === 'alpha') src[k].sort(byText(function(r){ return r.label; })); });
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
    var best = -1, ord = ML.stageOrder;
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
    ML.s.people = res[0].data; ML.s.accounts = res[1].data; ML.s.stages = res[2].data; ML.s.tasks = res[3].data; ML.resort();
    ML.hasHier = !ML.s.tasks.length || ('task_no' in ML.s.tasks[0]);
    ML.listsOk = !res[4].error && !!res[4].data && res[4].data.length > 0;
    ML.s.lists = ML.listsOk ? res[4].data : [];
    ML.applyLists(ML.s.lists);
    ML.loadedAt = Date.now();
    return true;
  };

  // ---------- Jerarquía: tarea → subtareas (un solo nivel) ----------
  // Una fila de ml_tasks es TAREA si parent_id es null y SUBTAREA si no. Código: tarea "01", subtarea "01-01".
  ML.hasHier = true;   // false si falta ejecutar migration_v4.sql
  ML.pad = function(n){ n = +n; return (n < 10 ? '0' : '') + n; };
  ML.isSub = function(t){ return !!(t && t.parent_id); };
  ML.parentOf = function(t){ return t && t.parent_id ? ML.task(t.parent_id) : null; };
  ML.childrenOf = function(id){ return ML.s.tasks.filter(function(t){ return t.parent_id === id; }); };
  ML.topTasks = function(){ return ML.s.tasks.filter(function(t){ return !t.parent_id; }); };
  ML.code = function(t){
    if(!t) return '';
    if(t.parent_id){ var p = ML.task(t.parent_id); return (p ? ML.code(p) : '??') + '-' + ML.pad(t.sub_no || 0); }
    return ML.pad(t.task_no != null ? t.task_no : t.id);
  };
  // Cuenta, VP y pilar de una fila: las subtareas heredan los de su tarea
  ML.eff = function(t){ var p = ML.parentOf(t); return p || t; };
  // "Unidades de trabajo": subtareas + tareas que no tienen subtareas (lo que realmente hay que hacer)
  ML.leaves = function(){
    var hasKids = {}; ML.s.tasks.forEach(function(t){ if(t.parent_id) hasKids[t.parent_id] = true; });
    return ML.s.tasks.filter(function(t){ return t.parent_id || !hasKids[t.id]; });
  };
  ML.nextTaskNo = function(){ return ML.s.tasks.reduce(function(m, t){ return Math.max(m, t.task_no || 0, ML.hasHier ? 0 : t.id); }, 0) + 1; };

  // ---------- Tareas ----------
  ML.addTask = async function(f){
    var row = {
      title: f.title, account_id: f.account_id || null, vp: f.vp || null, pilar: f.pilar || 'clientes', scope_text: f.scope_text || '',
      kind: f.kind || 'otro', owner: f.owner || null, due: f.due || null, status: 'pendiente', priority: f.priority || 'media', note: f.note || '', source: f.source || ''
    };
    if(ML.hasHier){ row.task_no = ML.nextTaskNo(); row.parent_id = null; }
    var r = await ML.sb.from('ml_tasks').insert(row).select().single();
    if(r.error){ await fail(r.error); return null; }
    ML.s.tasks.push(r.data); return r.data;
  };
  // La fecha de una tarea nunca es anterior a la de su última subtarea: si lo es, se sube a esa fecha
  ML.syncDue = async function(taskId){
    var t = ML.task(taskId); if(!t || t.parent_id) return false;
    var max = ''; ML.childrenOf(taskId).forEach(function(k){ if(k.due && k.due > max) max = k.due; });
    if(!max || (t.due && t.due >= max)) return false;
    t.due = max;
    var r = await ML.sb.from('ml_tasks').update({ due: max }).eq('id', taskId);
    if(r.error){ await fail(r.error); return false; }
    return true;
  };
  ML.addSubtask = async function(parentId, f){
    var p = ML.task(parentId); if(!p || p.parent_id) return null;
    var n = (p.sub_counter || 0) + 1;
    var row = {
      title: f.title, account_id: null, vp: null, pilar: p.pilar, scope_text: '', kind: f.kind || 'otro', owner: f.owner || null, due: f.due || null,
      status: 'pendiente', priority: f.priority || 'media', note: f.note || '', source: f.source || '', parent_id: parentId, sub_no: n
    };
    var r0 = await ML.sb.from('ml_tasks').update({ sub_counter: n }).eq('id', parentId);
    if(r0.error){ await fail(r0.error); return null; }
    p.sub_counter = n;
    var r = await ML.sb.from('ml_tasks').insert(row).select().single();
    if(r.error){ await fail(r.error); return null; }
    ML.s.tasks.push(r.data); await ML.syncDue(parentId); return r.data;
  };
  // Tarea → subtarea de otra tarea (o mover una subtarea a otra tarea). Devuelve null si va bien, o un texto de error.
  ML.moveUnder = async function(id, parentId){
    var t = ML.task(id), p = ML.task(parentId);
    if(!t || !p) return 'No se encontró la tarea';
    if(p.parent_id) return 'La tarea de destino ya es una subtarea (solo hay un nivel)';
    if(p.id === t.id) return 'Una tarea no puede colgar de sí misma';
    if(ML.childrenOf(t.id).length) return 'Esta tarea tiene subtareas: muévelas o conviértelas en tareas antes (solo hay un nivel)';
    if(t.parent_id === parentId) return 'Ya cuelga de esa tarea';
    var n = (p.sub_counter || 0) + 1;
    var r0 = await ML.sb.from('ml_tasks').update({ sub_counter: n }).eq('id', p.id);
    if(r0.error){ await fail(r0.error); return 'No se pudo guardar'; }
    p.sub_counter = n;
    t.parent_id = parentId; t.sub_no = n;
    var r = await ML.sb.from('ml_tasks').update({ parent_id: parentId, sub_no: n }).eq('id', id);
    if(r.error){ await fail(r.error); return 'No se pudo guardar'; }
    await ML.syncDue(parentId);
    return null;
  };
  // Subtarea → tarea: recupera su número de tarea anterior si lo tenía y hereda cuenta, VP y pilar de su tarea padre
  ML.promote = async function(id){
    var t = ML.task(id), p = ML.parentOf(t); if(!t || !p) return 'No es una subtarea';
    var patch = { parent_id: null, task_no: t.task_no != null ? t.task_no : ML.nextTaskNo(), account_id: p.account_id || null, vp: p.vp || null, pilar: p.pilar };
    Object.keys(patch).forEach(function(k){ t[k] = patch[k]; });
    var r = await ML.sb.from('ml_tasks').update(patch).eq('id', id);
    if(r.error){ await fail(r.error); return 'No se pudo guardar'; }
    return null;
  };
  ML.updateTask = async function(id, patch){
    var t = ML.task(id); if(!t) return false;
    if('status' in patch) patch.done_at = patch.status === 'hecha' ? new Date().toISOString() : null;
    Object.keys(patch).forEach(function(k){ t[k] = patch[k]; });
    var r = await ML.sb.from('ml_tasks').update(patch).eq('id', id);
    if(r.error){ await fail(r.error); return false; }
    if('due' in patch) await ML.syncDue(t.parent_id || t.id);
    return true;
  };
  ML.deleteTask = async function(id){
    ML.s.tasks = ML.s.tasks.filter(function(t){ return t.id !== id && t.parent_id !== id; });   // las subtareas se borran en cascada en la BD
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
    Object.keys(patch).forEach(function(k){ a[k] = patch[k]; }); ML.resort();
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
    ML.s.people.push(r.data); ML.resort(); return r.data;
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
    var row = { kind: kind, key: key, label: label, sort: sort, active: true, color: (kind === 'stage' || kind === 'pilar' || kind === 'status' || kind === 'priority') ? PALETTE[rows.length % PALETTE.length] : '', system: false };
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
    ML.s.people.forEach(function(p){ if(p.name === oldName) p.name = newName; }); ML.resort();
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
  // y el del histórico antiguo {text, end, status, priority, pilar, scope, am}.
  // Paso 1: convierte el JSON en borradores editables (no escribe nada). Cada borrador lleva avisos y si se incluye por defecto.
  ML.prepareImport = function(arr){
    var byName = {}, people = {}, titles = {}, drafts = [], seen = {};
    ML.s.accounts.forEach(function(a){ byName[a.name.toLowerCase()] = a; });
    ML.s.people.forEach(function(p){ people[p.name] = true; });
    ML.s.tasks.forEach(function(t){ titles[(t.parent_id ? t.parent_id + '|' : '') + String(t.title).trim().toLowerCase()] = true; });
    var keys = {}; arr.forEach(function(o){ if(o && o.key) keys[String(o.key)] = o; });   // "key": identificador para que otras filas del mismo archivo cuelguen de esta
    arr.forEach(function(o){
      if(!o) return;
      var d;
      if(o.title){
        var acc = o.account ? byName[String(o.account).toLowerCase()] : null, note = o.note || '', warns = [];
        var owner = o.owner || '';
        if(owner && !people[owner]){ note = (note ? note + ' · ' : '') + 'Responsable propuesto: ' + owner; owner = ''; warns.push('Responsable «' + o.owner + '» no está en tu lista'); }
        if(o.account && !acc){ note = (note ? note + ' · ' : '') + 'Cuenta no reconocida: ' + o.account; warns.push('Cuenta «' + o.account + '» no reconocida'); }
        var vp = OK_VP.indexOf(o.vp) >= 0 ? o.vp : '';
        if(o.vp && !vp) warns.push('VP «' + o.vp + '» no válida');
        // Subtarea: "parent" = código de una tarea existente ("07" o "#07")
        var par = null, pkey = '';
        if(o.parent != null && keys[String(o.parent)]){ pkey = String(o.parent); }
        else if(o.parent != null && String(o.parent).trim() !== ''){
          var pn = parseInt(String(o.parent).replace(/[^\d]/g, ''), 10);
          par = ML.topTasks().filter(function(x){ return x.task_no === pn; })[0] || null;
          if(!par) warns.push('Tarea padre «' + o.parent + '» no encontrada: se importará como tarea');
        }
        d = { key: o.key ? String(o.key) : '', parentKey: pkey, parent_id: par ? par.id : null, parentCode: par ? ML.code(par) : (pkey ? '«' + String(keys[pkey].title).slice(0, 60) + '»' : ''), title: String(o.title).trim(), account_id: acc ? acc.id : '', vp: vp, pilar: acc ? 'clientes' : vp ? 'vp' : 'clientes', scope_text: '',
              kind: OK_KIND.indexOf(o.kind) >= 0 ? o.kind : 'otro', owner: owner, due: /^\d{4}-\d{2}-\d{2}$/.test(o.due || '') ? o.due : '',
              priority: OK_PRIO.indexOf(o.priority) >= 0 ? o.priority : 'media', note: note, source: 'agente', status: 'pendiente', warns: warns };
      } else if(o.text){
        var pilar = o.pilar || 'vp', acc2 = null, vp2 = '', scope = '', w2 = [];
        if(pilar === 'clientes' && o.scope){ acc2 = byName[String(o.scope).toLowerCase()] || null; if(!acc2) scope = o.scope; }
        else if(pilar === 'vp' && o.scope){ vp2 = OLD_VP[o.scope] || ''; if(!vp2) scope = o.scope; }
        else if(o.scope){ scope = o.scope; }
        var owner2 = o.am || o.owner || '', note2 = '';
        if(owner2 && !people[owner2]){ note2 = 'Responsable original: ' + owner2; owner2 = ''; w2.push('Responsable «' + (o.am || o.owner) + '» no está en tu lista'); }
        var due = o.end || '';
        if(o.recurring && Array.isArray(o.recurDates)){
          var t = ML.today(); var next = o.recurDates.slice().sort().filter(function(x){ return x >= t; })[0];
          due = next || o.recurDates.slice().sort().pop() || due; note2 = (note2 ? note2 + ' · ' : '') + 'Recurrente (semanal), repetir a mano';
        }
        d = { title: String(o.text).trim(), account_id: acc2 ? acc2.id : '', vp: vp2, pilar: pilar, scope_text: scope, kind: 'otro', owner: owner2, due: due || '',
              priority: OK_PRIO.indexOf(o.priority) >= 0 ? o.priority : 'media', note: note2, source: 'importado', status: OLD_STATUS[o.status] || 'pendiente', warns: w2 };
      } else return;
      if(!d.title) return;
      var key = (d.parent_id ? d.parent_id + '|' : d.parentKey ? 'k:' + d.parentKey + '|' : '') + d.title.toLowerCase();
      d.dup = !!titles[key] || !!seen[key];
      if(d.dup) d.warns.unshift(titles[key] ? 'Ya existe una tarea con este título' : 'Título repetido en el archivo');
      seen[key] = true;
      d.include = !d.dup;
      drafts.push(d);
    });
    return drafts;
  };
  // Paso 2: guarda los borradores marcados (con los cambios que hayas hecho en la vista previa)
  ML.commitImport = async function(drafts){
    var n = 0, ids = {}; ML.lastSkipped = 0;
    for(var i = 0; i < drafts.length; i++){
      var d = drafts[i]; if(!d.include || !String(d.title).trim()) continue;
      if(d.parentKey && !d.parent_id){                       // cuelga de una tarea del mismo archivo
        if(!ids[d.parentKey]){ ML.lastSkipped++; continue; }  // su tarea padre no se importó
        d = Object.assign({}, d, { parent_id: ids[d.parentKey] });
      }
      var pilar = d.account_id ? 'clientes' : d.vp ? 'vp' : (d.pilar || 'clientes');
      if(d.parent_id && ML.task(d.parent_id)){
        var sb = await ML.addSubtask(d.parent_id, { title: String(d.title).trim(), kind: d.kind, owner: d.owner || '', due: d.due || null, priority: d.priority, note: d.note || '', source: d.source });
        if(sb){ if(d.status && d.status !== 'pendiente') await ML.updateTask(sb.id, { status: d.status }); n++; } else ML.lastSkipped++;
        continue;
      }
      var added = await ML.addTask({ title: String(d.title).trim(), account_id: d.account_id || null, vp: d.vp || null, pilar: pilar, scope_text: d.scope_text || '',
        kind: d.kind, owner: d.owner || '', due: d.due || null, priority: d.priority, note: d.note || '', source: d.source });
      if(added){ if(d.key) ids[d.key] = added.id; if(d.status && d.status !== 'pendiente') await ML.updateTask(added.id, { status: d.status }); n++; }
    }
    return n;
  };
})();
