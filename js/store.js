/* Datos, constantes y operaciones contra Supabase. Todo lo que cambia entre versiones (listas, etapas, estados) vive AQUÍ. */
(function(){
  'use strict';
  var ML = window.ML = window.ML || {};

  // ---------- Listas de valores (único sitio donde se definen) ----------
  ML.VPS = [
    { k: 'core',       label: 'Core Evolution' },
    { k: 'ai',         label: 'Insurance AI' },
    { k: 'everywhere', label: 'Everywhere' },
    { k: 'regtech',    label: 'RegTech' }
  ];
  ML.STAGES = [
    ['sin_contacto', 'Sin contacto'],
    ['solicitar_reunion', 'Solicitar fecha de reunión'],
    ['reunion', 'Reunión'],
    ['vp_presentada', 'VP presentada'],
    ['propuesta', 'Propuesta'],
    ['ganada', 'Ganada'],
    ['perdida', 'Perdida'],
    ['aparcada', 'Aparcada'],
    ['no_aplica', 'No aplica']
  ];
  ML.ACTIVE_STAGES = ['sin_contacto', 'solicitar_reunion', 'reunion', 'vp_presentada', 'propuesta'];
  ML.STATUS  = [['pendiente', 'Pendiente'], ['en_curso', 'En curso'], ['bloqueada', 'Bloqueada'], ['hecha', 'Hecha']];
  ML.KINDS   = [['reunion', 'Reunión'], ['presentar_vp', 'Presentar VP'], ['propuesta', 'Propuesta'], ['otro', 'Otro']];
  ML.PILARES = [['vp', 'VP'], ['clientes', 'Clientes'], ['partnership', 'Partnership'], ['marketing', 'Marketing']];
  ML.PRIOS   = [['alta', 'Alta'], ['media', 'Media'], ['baja', 'Baja']];

  // ---------- Utilidades ----------
  ML.esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  ML.lab = function(list, k){ for(var i = 0; i < list.length; i++){ if(list[i][0] === k) return list[i][1]; } return k || ''; };
  ML.vpLabel = function(k){ for(var i = 0; i < ML.VPS.length; i++){ if(ML.VPS[i].k === k) return ML.VPS[i].label; } return k || ''; };
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
  ML.s = { people: [], accounts: [], stages: [], tasks: [] };
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
    var res = await Promise.all([q('ml_people', 'sort'), q('ml_accounts', 'name'), q('ml_stages'), q('ml_tasks', 'id')]);
    for(var i = 0; i < res.length; i++){ if(res[i].error){ ML.toast('Error al leer datos: ' + res[i].error.message, true); return false; } }
    ML.s.people = res[0].data; ML.s.accounts = res[1].data; ML.s.stages = res[2].data; ML.s.tasks = res[3].data;
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
