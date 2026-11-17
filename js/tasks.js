const MLP_STATUSES = ['pendiente','en-curso','bloqueada','retrasada','hecho'];
const MLP_STATUS_LABELS = {pendiente:'Pendiente','en-curso':'En curso',bloqueada:'Bloqueada',retrasada:'Retrasada',hecho:'Hecho'};
const MLP_PRIORITIES = ['baja','media','alta'];
const MLP_PRIORITY_LABELS = {baja:'Baja',media:'Media',alta:'Alta'};
const MLP_KEY = 'market-leader-plan-tasks-v4';
let mlpTasks = [];
let mlpNextId = 2;

function isoToday(){ return new Date().toISOString().slice(0,10); }
function isoPlusDays(iso, days){ const d = new Date(iso+'T00:00:00'); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }

const MLP_PILARES = [['vp','VP'],['clientes','Clientes'],['partnership','Partnership'],['marketing','Marketing']];
const MLP_PILAR_LABELS = {vp:'VP',clientes:'Clientes',partnership:'Partnership',marketing:'Marketing'};
const MLP_VPS = ['Insurance Core Evolution','Insurance AI','Insurance Everywhere','Insurance RegTech','VP transversales'];
const MLP_ACC_FALLBACK = [["ABANCA Seguros", "Uxía Vázquez"], ["Admiral", "Sergio Novoa"], ["Aegon", "Jorge García"], ["Albia", "Raquel García"], ["Allianz", "Jaume Sunet"], ["AMA", "Javier Pastor"], ["ARAG", "Jordi Romero"], ["Asepeyo", "Jordi Romero"], ["Asisa", "Sergio Novoa"], ["Atradius", "Jaume Sunet"], ["AXA", "Isabel Zapata"], ["CaixaBank", "Jordi Romero"], ["Catalana Occidente (GCO)", "Jaume Sunet"], ["CECOEL", "Jaume Sunet"], ["CESCE", "Javier Pastor"], ["Consorcio de Compensación de Seguros", "Helena Cañil"], ["DKV", "Jordi Romero"], ["FIATC", "Jordi Romero"], ["FREMAP", "Sergio Novoa"], ["Generali", "Jaume Sunet"], ["Helvetia Caser", "Javier Pastor"], ["Línea Directa", "Isabel Zapata"], ["Mapfre", "Enrique Manzano / Antonio Iglesias"], ["MC Mutual", "Jordi Romero"], ["Mutua Madrileña", "Helena Cañil"], ["Ocaso", "Javier Pastor"], ["Onlygal", "Jordi Romero"], ["Pelayo", "Jorge García"], ["PSN", "Javier Pastor"], ["Reale", "Isabel Zapata"], ["Sanitas", "Sergio Novoa"], ["Santalucía", "Raquel García"], ["SegurCaixa", "Helena Cañil"], ["Zurich", "Jordi Romero"]].map(function(a){ return {client:a[0], am:a[1]}; });
let mlpFilterStatus = '';
let mlpSortKey = '';
let mlpSortDir = 1;
function mlpAccounts(){
  const src = (Array.isArray(window.__mlpAcc) && window.__mlpAcc.length) ? window.__mlpAcc : MLP_ACC_FALLBACK;
  return src.slice().sort((a,b)=> a.client.localeCompare(b.client,'es'));
}
function mlpAmList(extra){
  const set = {'Fernando Sánchez':1};
  mlpAccounts().forEach(a=>{ if(a.am) set[a.am] = 1; });
  if(extra) set[extra] = 1;
  return Object.keys(set).sort((a,b)=> a.localeCompare(b,'es'));
}
function mlpSelect(cls, opts, value, onChange){
  const s = document.createElement('select');
  s.className = cls;
  opts.forEach(o=>{
    const op = document.createElement('option');
    op.value = o[0]; op.textContent = o[1];
    if(o[0] === value) op.selected = true;
    s.appendChild(op);
  });
  s.addEventListener('change', ()=> onChange(s.value));
  return s;
}
function mlpVisibleTasks(){
  let list = mlpTasks.filter(t=> !mlpFilterStatus || t.status === mlpFilterStatus);
  if(mlpSortKey){
    const val = t => {
      if(mlpSortKey === 'status') return MLP_STATUSES.indexOf(t.status);
      return t[mlpSortKey] || '';
    };
    list = list.slice().sort((a,b)=>{
      const va = val(a), vb = val(b);
      if(mlpSortKey !== 'status'){
        if(!va && vb) return 1;
        if(va && !vb) return -1;
      }
      if(va < vb) return -1 * mlpSortDir;
      if(va > vb) return 1 * mlpSortDir;
      return (a.id||0) - (b.id||0);
    });
  }
  return list;
}

function renderMlpTasks(){
  const container = document.getElementById('mlp-tasks');
  if(!container) return;
  container.innerHTML = '';
  if(!mlpTasks.length){
    container.innerHTML = '<p class="mlp-empty">Sin tareas todavía — añade la primera con "+ Añadir tarea".</p>';
    return;
  }
  // migración: el antiguo campo libre "owner" pasa a "am"; ámbito vacío = VP
  mlpTasks.forEach(t=>{ if(t.am === undefined){ t.am = t.owner || ''; } if(t.scope === undefined){ t.scope = ''; }
    if(!t.pilar){ t.pilar = (t.scope && mlpAccounts().some(a=>a.client === t.scope)) ? 'clientes' : 'vp'; } });

  const inner = document.createElement('div');
  inner.className = 'mlp-inner';
  container.appendChild(inner);

  const visible = mlpVisibleTasks();

  const bar = document.createElement('div');
  bar.className = 'mlp-toolbar';
  const lab = document.createElement('label');
  lab.appendChild(document.createTextNode('Estado '));
  lab.appendChild(mlpSelect('', [['','Todos']].concat(MLP_STATUSES.map(s=>[s, MLP_STATUS_LABELS[s]])), mlpFilterStatus, v=>{ mlpFilterStatus = v; renderMlpTasks(); }));
  bar.appendChild(lab);
  const cnt = document.createElement('span');
  cnt.className = 'mlp-count';
  cnt.textContent = visible.length + ' de ' + mlpTasks.length + ' tareas';
  bar.appendChild(cnt);
  inner.appendChild(bar);

  const headers = document.createElement('div');
  headers.className = 'mlp-col-headers';
  const arrow = k => mlpSortKey === k ? (mlpSortDir === 1 ? ' ▲' : ' ▼') : '';
  const sortable = (k, label) => '<span class="mlp-sort' + (mlpSortKey === k ? ' on' : '') + '" data-sort="' + k + '" title="Clic para ordenar">' + label + arrow(k) + '</span>';
  headers.innerHTML = sortable('status','Estado') + '<span>Prior.</span><span>Tarea</span><span>Pilar</span><span>Ámbito</span><span>AM responsable</span>' + sortable('start','Inicio') + sortable('end','Fin') + '<span></span>';
  headers.querySelectorAll('.mlp-sort').forEach(h=>{
    h.addEventListener('click', ()=>{
      const k = h.dataset.sort;
      if(mlpSortKey !== k){ mlpSortKey = k; mlpSortDir = 1; }
      else if(mlpSortDir === 1){ mlpSortDir = -1; }
      else { mlpSortKey = ''; mlpSortDir = 1; }
      renderMlpTasks();
    });
  });
  inner.appendChild(headers);

  if(!visible.length){
    const e = document.createElement('p');
    e.className = 'mlp-empty';
    e.textContent = 'Ninguna tarea con ese estado.';
    inner.appendChild(e);
  }

  visible.forEach(task=>{
    const row = document.createElement('div');
    row.className = 'mlp-task' + (task.status === 'hecho' ? ' done' : '');

    const status = document.createElement('span');
    status.className = 'mlp-status';
    status.dataset.status = task.status;
    status.textContent = MLP_STATUS_LABELS[task.status];
    status.title = 'Clic para cambiar de estado';
    status.addEventListener('click', ()=>{
      const idx = MLP_STATUSES.indexOf(task.status);
      task.status = MLP_STATUSES[(idx+1) % MLP_STATUSES.length];
      persistMlpTasks();
      renderMlpTasks();
      renderMlpGantt();
    });

    const priority = document.createElement('span');
    priority.className = 'mlp-priority';
    priority.dataset.priority = task.priority || 'media';
    priority.textContent = MLP_PRIORITY_LABELS[task.priority || 'media'];
    priority.title = 'Clic para cambiar de prioridad';
    priority.addEventListener('click', ()=>{
      const idx = MLP_PRIORITIES.indexOf(task.priority || 'media');
      task.priority = MLP_PRIORITIES[(idx+1) % MLP_PRIORITIES.length];
      persistMlpTasks();
      renderMlpTasks();
      renderMlpGantt();
    });

    const text = document.createElement('div');
    text.className = 'mlp-task-text';
    text.contentEditable = 'true';
    text.textContent = task.text;
    if(task.recurring){
      const badge = document.createElement('span');
      badge.className = 'mlp-recur-badge';
      badge.textContent = '🔁 recurrente (semanal, lunes)';
      badge.contentEditable = 'false';
      text.appendChild(badge);
    }
    text.addEventListener('blur', ()=>{
      task.text = text.textContent.replace(/🔁.*$/,'').trim();
      persistMlpTasks();
      renderMlpGantt();
    });

    const accs = mlpAccounts();
    const pilar = mlpSelect('mlp-sel', MLP_PILARES, task.pilar || 'vp', v=>{
      task.pilar = v;
      task.scope = '';
      persistMlpTasks();
      renderMlpTasks();
      renderMlpGantt();
    });
    pilar.title = 'Pilar al que pertenece la tarea';

    let scope;
    if(task.pilar === 'clientes'){
      const scopeOpts = [['','— Cuenta —']].concat(accs.map(a=>[a.client, a.client]));
      if(task.scope && !accs.some(a=>a.client === task.scope)) scopeOpts.push([task.scope, task.scope]);
      scope = mlpSelect('mlp-sel', scopeOpts, task.scope || '', v=>{
        task.scope = v;
        const acc = accs.find(a=>a.client === v);
        if(acc && acc.am) task.am = acc.am;
        persistMlpTasks();
        renderMlpTasks();
        renderMlpGantt();
      });
      scope.title = 'Cuenta del seguimiento VP por AM';
    } else if(task.pilar === 'vp' || !task.pilar){
      const scopeOpts = [['','— VP —']].concat(MLP_VPS.map(v=>[v, v]));
      if(task.scope && MLP_VPS.indexOf(task.scope) < 0) scopeOpts.push([task.scope, task.scope]);
      scope = mlpSelect('mlp-sel', scopeOpts, task.scope || '', v=>{
        task.scope = v;
        persistMlpTasks();
        renderMlpGantt();
      });
      scope.title = 'VP a la que afecta la tarea';
    } else {
      scope = document.createElement('input');
      scope.type = 'text';
      scope.className = 'mlp-owner';
      scope.placeholder = 'Ámbito (texto libre)';
      scope.value = task.scope || '';
      scope.addEventListener('change', ()=>{ task.scope = scope.value.trim(); persistMlpTasks(); renderMlpGantt(); });
    }

    const amOpts = [['','Sin asignar']].concat(mlpAmList(task.am).map(a=>[a, a]));
    const am = mlpSelect('mlp-sel', amOpts, task.am || '', v=>{
      task.am = v;
      persistMlpTasks();
      renderMlpGantt();
    });

    const start = document.createElement('input');
    start.type = 'date';
    start.className = 'mlp-date';
    start.value = task.start || '';
    start.addEventListener('change', ()=>{
      task.start = start.value;
      if(task.start && task.end && task.end < task.start){ task.end = task.start; end.value = task.end; }
      persistMlpTasks();
      renderMlpGantt();
    });

    const end = document.createElement('input');
    end.type = 'date';
    end.className = 'mlp-date';
    end.value = task.end || '';
    end.addEventListener('change', ()=>{
      task.end = end.value;
      if(task.start && task.end && task.end < task.start){ task.start = task.end; start.value = task.start; }
      persistMlpTasks();
      renderMlpGantt();
    });

    const del = document.createElement('span');
    del.className = 'mlp-task-del';
    del.textContent = '×';
    del.title = 'Eliminar tarea';
    del.addEventListener('click', ()=>{
      mlpTasks = mlpTasks.filter(t=>t.id !== task.id);
      persistMlpTasks();
      renderMlpTasks();
      renderMlpGantt();
    });

    row.appendChild(status);
    row.appendChild(priority);
    row.appendChild(text);
    row.appendChild(pilar);
    row.appendChild(scope);
    row.appendChild(am);
    row.appendChild(start);
    row.appendChild(end);
    row.appendChild(del);
    inner.appendChild(row);
  });
}

document.addEventListener('mlp-acc', ()=>{
  const a = document.activeElement;
  if(a && a.closest && a.closest('#mlp-tasks') && (a.isContentEditable || a.tagName === 'INPUT')) return;
  renderMlpTasks();
});

function renderMlpGantt(){
  const container = document.getElementById('mlp-gantt-chart');
  if(!container) return;
  container.innerHTML = '';
  const dated = mlpTasks.filter(t => t.start && t.end);
  if(!dated.length){
    container.innerHTML = '<p class="gantt-empty">Sin fechas suficientes todavía — añade fecha de inicio y fin a alguna tarea en el listado para verla aquí.</p>';
    return;
  }
  const toDate = iso => new Date(iso+'T00:00:00');
  let rangeStart = toDate(dated.reduce((a,t)=> t.start < a ? t.start : a, dated[0].start));
  let rangeEnd = toDate(dated.reduce((a,t)=> t.end > a ? t.end : a, dated[0].end));
  rangeStart.setDate(rangeStart.getDate() - 2);
  rangeEnd.setDate(rangeEnd.getDate() + 2);
  const totalDays = Math.max(1, Math.round((rangeEnd - rangeStart) / 86400000));
  const pxPerDay = 14;

  const wrap = document.createElement('div');
  wrap.className = 'gantt-wrap';

  const monthsRow = document.createElement('div');
  monthsRow.className = 'gantt-months';
  monthsRow.style.width = (totalDays * pxPerDay) + 'px';
  let cursor = new Date(rangeStart);
  cursor.setDate(1);
  const monthFmt = new Intl.DateTimeFormat('es-ES', {month:'short', year:'2-digit'});
  while(cursor <= rangeEnd){
    const monthStart = cursor < rangeStart ? rangeStart : cursor;
    const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth()+1, 1);
    const monthEnd = nextMonth < rangeEnd ? nextMonth : rangeEnd;
    const days = Math.max(1, Math.round((monthEnd - monthStart)/86400000));
    const m = document.createElement('div');
    m.className = 'gantt-month';
    m.style.width = (days * pxPerDay) + 'px';
    m.textContent = monthFmt.format(cursor);
    monthsRow.appendChild(m);
    cursor = nextMonth;
  }
  wrap.appendChild(monthsRow);

  const weeksRow = document.createElement('div');
  weeksRow.className = 'gantt-weeks';
  weeksRow.style.width = (totalDays * pxPerDay) + 'px';
  let wCursor = new Date(rangeStart);
  wCursor.setDate(wCursor.getDate() - ((wCursor.getDay()+6)%7)); // snap back to Monday
  const weekDayFmt = new Intl.DateTimeFormat('es-ES', {day:'2-digit', month:'short'});
  while(wCursor <= rangeEnd){
    const weekStart = wCursor < rangeStart ? rangeStart : wCursor;
    const nextWeek = new Date(wCursor); nextWeek.setDate(nextWeek.getDate()+7);
    const weekEnd = nextWeek < rangeEnd ? nextWeek : rangeEnd;
    const days = Math.max(1, Math.round((weekEnd - weekStart)/86400000));
    const w = document.createElement('div');
    w.className = 'gantt-week';
    w.style.width = (days * pxPerDay) + 'px';
    w.textContent = weekDayFmt.format(wCursor);
    weeksRow.appendChild(w);
    wCursor = nextWeek;
  }
  wrap.appendChild(weeksRow);

  mlpTasks.forEach(task=>{
    const row = document.createElement('div');
    row.className = 'gantt-row';
    const label = document.createElement('div');
    label.className = 'gantt-label';
    label.textContent = task.text || '(sin nombre)';
    label.title = task.text || '';
    row.appendChild(label);

    const track = document.createElement('div');
    track.className = 'gantt-track';
    track.style.width = (totalDays * pxPerDay) + 'px';
    if(task.recurring && Array.isArray(task.recurDates) && task.recurDates.length){
      const dates = task.recurDates.slice().sort();
      const firstOffset = Math.round((toDate(dates[0]) - rangeStart)/86400000);
      const lastOffset = Math.round((toDate(dates[dates.length-1]) - rangeStart)/86400000);
      const line = document.createElement('div');
      line.className = 'gantt-recur-line';
      line.dataset.status = task.status;
      line.style.left = (firstOffset * pxPerDay + pxPerDay/2) + 'px';
      line.style.width = Math.max(0,(lastOffset - firstOffset) * pxPerDay) + 'px';
      track.appendChild(line);
      dates.forEach(dt=>{
        const offsetDays = Math.round((toDate(dt) - rangeStart)/86400000);
        const dot = document.createElement('div');
        dot.className = 'gantt-recur-dot';
        dot.dataset.status = task.status;
        dot.dataset.priority = task.priority || 'media';
        dot.style.left = (offsetDays * pxPerDay + pxPerDay/2) + 'px';
        dot.title = (task.text||'') + ' — ' + dt + (task.am ? ' — ' + task.am : '');
        track.appendChild(dot);
      });
    } else if(task.start && task.end){
      const s = toDate(task.start), e = toDate(task.end);
      const offsetDays = Math.round((s - rangeStart)/86400000);
      const durDays = Math.max(1, Math.round((e - s)/86400000) + 1);
      const bar = document.createElement('div');
      bar.className = 'gantt-bar';
      bar.dataset.status = task.status;
      bar.dataset.priority = task.priority || 'media';
      bar.style.left = (offsetDays * pxPerDay) + 'px';
      bar.style.width = (durDays * pxPerDay) + 'px';
      bar.textContent = task.am || '';
      bar.title = (task.text||'') + ' — ' + task.start + ' a ' + task.end + (task.pilar ? ' — ' + (MLP_PILAR_LABELS[task.pilar]||task.pilar) : '') + (task.scope ? ' — ' + task.scope : '') + (task.am ? ' — ' + task.am : '');
      track.appendChild(bar);
    }
    row.appendChild(track);
    wrap.appendChild(row);
  });

  container.appendChild(wrap);
}

const btnAddTask = document.getElementById('btnAddTask');
if(btnAddTask){
  btnAddTask.addEventListener('click', ()=>{
    const today = isoToday();
    mlpTasks.push({id: Date.now(), text:'Nueva tarea', start:today, end:isoPlusDays(today,7), status:'pendiente', priority:'media', pilar:'vp', scope:'', am:''});
    persistMlpTasks();
    renderMlpTasks();
    renderMlpGantt();
  });
}

// ---- Persistencia en Supabase (tabla "tasks": una fila por tarea) ----
let mlpSaved = {};          // id -> JSON guardado
let mlpWrites = 0;          // escrituras en curso
let mlpChain = Promise.resolve();
let mlpReloadTimer = null;
function mlpMsg(t, err){
  const el = document.getElementById('mlp-status');
  if(!el) return;
  el.textContent = t || '';
  el.className = 'mlp-status-msg' + (err ? ' err' : '');
}
function persistMlpTasks(){
  if(!window.MLDB || !MLDB.canWrite()){ mlpMsg('Tu acceso es de solo lectura: los cambios no se guardan.', true); return Promise.resolve(); }
  mlpWrites++;
  mlpChain = mlpChain.then(async ()=>{
    const cur = {};
    mlpTasks.forEach(t=>{ cur[String(t.id)] = t; });
    const up = [], del = [];
    Object.keys(cur).forEach(id=>{ if(JSON.stringify(cur[id]) !== mlpSaved[id]) up.push({id:id, data:cur[id], updated_by:MLDB.userId}); });
    Object.keys(mlpSaved).forEach(id=>{ if(!(id in cur)) del.push(id); });
    if(up.length){
      const r = await MLDB.sb.from('tasks').upsert(up);
      if(r.error) throw r.error;
      up.forEach(u=>{ mlpSaved[u.id] = JSON.stringify(u.data); });
    }
    if(del.length){
      const r = await MLDB.sb.from('tasks').delete().in('id', del);
      if(r.error) throw r.error;
      del.forEach(id=>{ delete mlpSaved[id]; });
    }
    mlpMsg('');
  }).catch(e=>{
    mlpMsg('No se pudo guardar: ' + ((e && e.message) || 'error desconocido'), true);
  }).then(()=>{ mlpWrites--; });
  return mlpChain;
}

async function loadMlpTasks(){
  if(!window.MLDB) return;
  const r = await MLDB.sb.from('tasks').select('id,data');
  if(r.error){ mlpMsg('No se pudieron leer las tareas: ' + r.error.message, true); return; }
  const next = r.data.map(x=>x.data).sort((a,b)=>(a.id||0)-(b.id||0));
  const saved = {};
  next.forEach(t=>{ saved[String(t.id)] = JSON.stringify(t); });
  const same = JSON.stringify(next) === JSON.stringify(mlpTasks);
  mlpSaved = saved;
  if(same) return;
  mlpTasks = next;
  mlpNextId = mlpTasks.length ? Math.max(...mlpTasks.map(t=>t.id||0)) + 1 : 1;
  renderMlpTasks();
  renderMlpGantt();
}
function scheduleMlpReload(){
  clearTimeout(mlpReloadTimer);
  mlpReloadTimer = setTimeout(function tick(){
    const a = document.activeElement;
    const editing = a && a.closest && a.closest('#mlp-tasks') && (a.isContentEditable || a.tagName === 'INPUT' || a.tagName === 'SELECT');
    if(mlpWrites > 0 || editing){ mlpReloadTimer = setTimeout(tick, 1500); return; }
    loadMlpTasks();
  }, 400);
}
window.startMlpTasks = function(){
  loadMlpTasks();
  MLDB.sb.channel('rt-tasks-' + Math.random().toString(36).slice(2))
    .on('postgres_changes', {event:'*', schema:'public', table:'tasks'}, scheduleMlpReload)
    .subscribe();
};

const btnExportTasks = document.getElementById('btnExportTasks');
if(btnExportTasks){
  btnExportTasks.addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(mlpTasks, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'market-leader-plan-tareas-' + isoToday() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}
const btnImportTasks = document.getElementById('btnImportTasks');
const mlpImportFile = document.getElementById('mlpImportFile');
if(btnImportTasks && mlpImportFile){
  btnImportTasks.addEventListener('click', ()=> mlpImportFile.click());
  mlpImportFile.addEventListener('change', ()=>{
    const file = mlpImportFile.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const imported = JSON.parse(reader.result);
        if(!Array.isArray(imported)) throw new Error('El archivo no contiene una lista de tareas.');
        const ok = confirm('Vas a reemplazar las ' + mlpTasks.length + ' tareas actuales por las ' + imported.length + ' del archivo importado. ¿Continuar?');
        if(ok){
          mlpTasks = imported;
          mlpNextId = mlpTasks.length ? Math.max(...mlpTasks.map(t=>t.id||0)) + 1 : 1;
          persistMlpTasks();
          renderMlpTasks();
          renderMlpGantt();
        }
      }catch(e){
        alert('No se pudo importar el archivo: ' + e.message);
      }
      mlpImportFile.value = '';
    };
    reader.readAsText(file);
  });
}

document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const nav = btn.closest('.tab-nav');
    nav.querySelectorAll('.tab-btn').forEach(b=>{
      b.classList.toggle('active', b===btn);
      const pane = document.getElementById(b.dataset.tab);
      if(pane) pane.style.display = (b===btn) ? '' : 'none';
    });
  });
});

