
(function(){
  var TASKS=[{k:'reunion',label:'Convocar reunión'},{k:'vp',label:'Presentar VP'},{k:'prop',label:'Enviar propuesta'}];
  var VPS=[{k:'core',label:'VP Insurance Core Evolution'},{k:'ai',label:'VP Insurance AI'}];
  var STATES=['Pendiente','En curso','Hecho','Bloqueado'];
  var OLA_LABEL={'0':'Ola 0','1':'Ola 1','2':'Ola 2','aparcada':'Aparcada','descartada':'Descartada','':'Sin ola'};
  var OLA_ORD={'0':0,'1':1,'2':2,'aparcada':3,'descartada':3,'':4};
  var SIN='Sin asignar';
  var accounts={}, plans={}, db=null, canWrite=true, loaded=false, queue={};
  var $=function(id){return document.getElementById('pv-'+id)};

  function iso(d){var m=d.getMonth()+1,dd=d.getDate();return d.getFullYear()+'-'+(m<10?'0':'')+m+'-'+(dd<10?'0':'')+dd}
  var today=iso(new Date());
  $('asof').textContent='Hoy: '+today;
  function slug(s){return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'cuenta'}
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function stCls(s){return s.replace(' ','-')}
  function fmt(d){return d?d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4):''}
  function tk(vp,k){return vp+'_'+k}
  function getTask(id,key){var p=plans[id];return Object.assign({status:'Pendiente',due:'',note:'',parked:false},(p&&p.tasks&&p.tasks[key])||{})}
  function isVenc(t){return !t.parked && t.status!=='Hecho' && t.due && t.due<today}
  function amOf(a){return (a.am&&a.am.trim())||SIN}
  function amList(a){return [amOf(a)]}
  function applies(a,vp){return vp==='core' ? !!a.core : !!(a.ai && a.ai.ola!=='aparcada' && a.ai.ola!=='descartada')}
  function setMsg(t,err){var m=$('msg');m.textContent=t||'';m.className='status-msg'+(err?' err':'')}

  function write(path,data){
    var q=queue[path]||Promise.resolve();
    queue[path]=q.then(function(){return db.doc(path).set(data)}).catch(function(e){
      setMsg('No se pudo guardar'+(e&&e.code==='invalid_argument'?': tu acceso es de solo lectura.':'. Inténtalo de nuevo.'),true);
      if(e&&e.code==='invalid_argument'){canWrite=false}
    });
    return queue[path];
  }
  function savePlan(id){var p=plans[id]||{tasks:{}};write('plan/'+id,{tasks:p.tasks||{},notes:p.notes||{}})}
  function setNote(id,vp,text){var p=plans[id]=plans[id]||{tasks:{}}; p.notes=Object.assign({},p.notes||{}); p.notes[vp]=text; savePlan(id); render()}
  function vpNote(id,vp){var p=plans[id];return (p&&p.notes&&p.notes[vp])||''}
  function setTask(id,key,patch){
    var p=plans[id]=plans[id]||{tasks:{}}; p.tasks=p.tasks||{};
    p.tasks[key]=Object.assign({},p.tasks[key]||{status:'Pendiente',due:''},patch);
    savePlan(id); render();
  }
  function saveAccount(id){
    var a=accounts[id], d={client:a.client,am:a.am||'',amSrc:a.amSrc||'',core:!!a.core};
    if(a.ai) d.ai=a.ai;
    write('accounts/'+id,d);
  }

  function ordered(){
    var list=Object.keys(accounts).map(function(id){return Object.assign({id:id},accounts[id])});
    var fAm=$('fAm').value, fVp=$('fVp').value, fOla=$('fOla').value, fSt=$('fSt').value, fV=$('fVenc').checked;
    var vps=fVp?[fVp]:['core','ai'];
    list=list.filter(function(a){
      if(fAm && amList(a).indexOf(fAm)<0) return false;
      if(fOla){ if(!a.ai || a.ai.ola!==fOla) return false; }
      var keys=[]; vps.forEach(function(v){if(applies(a,v))TASKS.forEach(function(t){keys.push(tk(v,t.k))})});
      if((fVp||fSt||fV) && !keys.length) return false;
      if(fSt && !keys.some(function(k){var t=getTask(a.id,k); return fSt==='Aparcada' ? t.parked : (!t.parked && t.status===fSt)})) return false;
      if(fV && !keys.some(function(k){return isVenc(getTask(a.id,k))})) return false;
      return true;
    });
    var groups={};
    list.forEach(function(a){amList(a).forEach(function(g){(groups[g]=groups[g]||[]).push(a)})});
    var names=Object.keys(groups).sort(function(x,y){if(x===SIN)return 1;if(y===SIN)return -1;return x.localeCompare(y,'es')});
    names.forEach(function(n){groups[n].sort(function(a,b){
      var oa=OLA_ORD[a.ai?a.ai.ola:'']!=null?OLA_ORD[a.ai?a.ai.ola:'']:4, ob=OLA_ORD[b.ai?b.ai.ola:'']!=null?OLA_ORD[b.ai?b.ai.ola:'']:4;
      return (oa-ob)||a.client.localeCompare(b.client,'es')})});
    return {names:names,groups:groups};
  }
  function keysOf(a){var ks=[];VPS.forEach(function(v){if(applies(a,v.k))TASKS.forEach(function(t){ks.push(tk(v.k,t.k))})});return ks}

  function renderKpis(){
    var ids=Object.keys(accounts), tot=0,h=0,c=0,b=0,v=0,sf=0, prop=0, pk=0;
    ids.forEach(function(id){
      if(accounts[id].amSrc==='propuesto')prop++;
      keysOf(accounts[id]).forEach(function(k){
        var x=getTask(id,k); if(x.parked){pk++;return} tot++;
        if(x.status==='Hecho')h++; else if(x.status==='En curso')c++; else if(x.status==='Bloqueado')b++;
        if(isVenc(x))v++; if(x.status!=='Hecho'&&!x.due)sf++;
      });
    });
    var amSet={}; ids.forEach(function(id){amList(accounts[id]).forEach(function(n){amSet[n]=1})});
    var k=[['',ids.length,'cuentas con '+Object.keys(amSet).length+' responsables'],
           ['hecho',h,'tareas hechas de '+tot+(tot?' ('+Math.round(h/tot*100)+'%)':'')],
           ['curso',c,'tareas en curso'],['',b,'tareas bloqueadas'],['venc',v,'tareas vencidas'],['',sf,'pendientes sin fecha'],['',pk,'tareas aparcadas']];
    $('kpis').innerHTML=k.map(function(x){return '<div class="kpi '+x[0]+'"><b>'+x[1]+'</b><span>'+x[2]+'</span></div>'}).join('');
    $('amnote').style.display=prop?'':'none';
    $('amnote').innerHTML='<b>Responsables:</b> los del plan comercial de IA (19/10/2026). En <b>'+prop+(prop===1?' cuenta':' cuentas')+'</b> el plan no indica responsable y aparece uno propuesto por el propietario de sus oportunidades de booking (marcado «AM propuesto»). Corrígelo en la tabla donde haga falta.';
  }
  function renderFilters(){
    var cur=$('fAm').value, names={};
    Object.keys(accounts).forEach(function(id){amList(accounts[id]).forEach(function(n){names[n]=1})});
    var arr=Object.keys(names).sort(function(x,y){if(x===SIN)return 1;if(y===SIN)return -1;return x.localeCompare(y,'es')});
    $('fAm').innerHTML='<option value="">Todos</option>'+arr.map(function(n){return '<option'+(n===cur?' selected':'')+'>'+esc(n)+'</option>'}).join('');
    $('amlist').innerHTML=arr.filter(function(n){return n!==SIN}).map(function(n){return '<option value="'+esc(n)+'">'}).join('');
  }
  function cellHtml(id,vp,t,a){
    var key=tk(vp,t.k), x=getTask(id,key), venc=isVenc(x), dis=canWrite?'':' disabled', dis2=(canWrite&&!x.parked)?'':' disabled';
    var vpl=vp==='core'?'Core Evolution':'AI', ttl=vpl+' · '+t.label+' · '+a.client;
    var h='<div class="cell'+(x.parked?' parked':'')+'">';
    if(vp==='ai'&&t.k==='prop'&&a.ai&&a.ai.oferta) h+='<span class="oferta">'+esc(a.ai.oferta)+'</span>';
    h+='<div class="row"><select class="st '+stCls(x.status)+'" data-id="'+id+'" data-k="'+key+'" data-f="status" aria-label="Estado: '+esc(ttl)+'"'+dis2+'>'+
       STATES.map(function(s){return '<option'+(s===x.status?' selected':'')+'>'+s+'</option>'}).join('')+'</select>'+
       '<button type="button" class="nb'+((x.note||x.parked)?' has':'')+'" data-id="'+id+'" data-k="'+key+'" data-title="'+esc(ttl)+'" title="'+esc(x.note?x.note:'Cómo abordar la VP / aparcar')+'" aria-label="Cómo abordar y aparcar: '+esc(ttl)+'">✎</button></div>';
    h+='<input type="date" class="dt'+(venc?' venc':'')+'" value="'+esc(x.due||'')+'" data-id="'+id+'" data-k="'+key+'" data-f="due" aria-label="Fecha: '+esc(ttl)+'"'+dis2+'>';
    if(x.parked) h+='<span class="pkd">Aparcada</span>';
    if(venc) h+='<span class="flag">Vencida</span>';
    return h+'</div>';
  }
  function offCell(a,vp){
    if(vp==='core') return '<td colspan="3" class="off">Sin plan comercial de Core Evolution para esta cuenta</td>';
    if(a.ai&&(a.ai.ola==='aparcada'||a.ai.ola==='descartada')) return '<td colspan="3" class="off park"><b>'+(a.ai.ola==='descartada'?'Descartada en el plan':'Aparcada')+'</b>'+(a.ai.revision?' · revisión '+fmt(a.ai.revision):'')+(a.ai.motivo?'<br>'+esc(a.ai.motivo):'')+'</td>';
    return '<td colspan="3" class="off">Sin plan comercial de IA para esta cuenta</td>';
  }
  var pendingRender=false;
  function render(){
    var ae=document.activeElement; if(ae&&ae.dataset&&ae.dataset.note&&$('tbody').contains(ae)){pendingRender=true;return}
    renderKpis(); renderFilters();
    $('thead1').innerHTML='<th rowspan="2">Responsable (AM)</th><th rowspan="2">Cliente</th><th colspan="3" class="grp g1">VP Insurance Core Evolution</th><th colspan="3" class="grp g2">VP Insurance AI</th>';
    $('thead2').innerHTML=VPS.map(function(v){return TASKS.map(function(t){return '<th class="sub '+(v.k==='core'?'g1':'g2')+'">'+t.label+'</th>'}).join('')}).join('');
    var r=ordered(), body='';
    r.names.forEach(function(n){
      var rows=r.groups[n], done=0, tot=0;
      rows.forEach(function(a){keysOf(a).forEach(function(k){var x=getTask(a.id,k); if(x.parked)return; tot++;if(x.status==='Hecho')done++})});
      rows.forEach(function(a,i){
        body+='<tr'+(i===0?' class="first"':'')+'>';
        if(i===0) body+='<td class="am" rowspan="'+(rows.length*2)+'"><span class="n">'+esc(n)+'</span><span class="prog">'+rows.length+' cliente'+(rows.length>1?'s':'')+' · '+done+'/'+tot+' tareas hechas</span></td>';
        var chip=a.ai?'<span class="chip ola'+esc(a.ai.ola)+'">'+OLA_LABEL[a.ai.ola||'']+'</span>':'';
        var caso=a.ai&&a.ai.caso?'<span class="caso">'+esc(a.ai.caso)+'</span>':'';
        body+='<td class="cli" rowspan="2"><div class="c"><span>'+esc(a.client)+' '+chip+'</span>'+
              (canWrite?'<button class="btn ghost" type="button" data-del="'+a.id+'" title="Quitar cuenta" aria-label="Quitar '+esc(a.client)+'">×</button>':'')+'</div>'+caso+
              '<input type="text" class="am-in" list="pv-amlist" value="'+esc(a.am||'')+'" placeholder="Asignar AM" data-amid="'+a.id+'" aria-label="AM de '+esc(a.client)+'"'+(canWrite?'':' disabled')+'>'+
              (a.amSrc==='propuesto'?'<span class="prop-tag">AM propuesto</span>':'')+'</td>';
        VPS.forEach(function(v){
          if(applies(a,v.k)) TASKS.forEach(function(t,j){body+='<td class="'+(j===0?'gs ':'')+(v.k==='core'?'g1c':'g2c')+'">'+cellHtml(a.id,v.k,t,a)+'</td>'});
          else body+=offCell(a,v.k);
        });
        body+='</tr><tr class="nrow">';
        VPS.forEach(function(v){
          body+='<td colspan="3" class="gs vpn '+(v.k==='core'?'g1c':'g2c')+'"><textarea rows="2" data-note="'+v.k+'" data-id="'+a.id+'" placeholder="Cómo abordar la VP '+(v.k==='core'?'Core Evolution':'AI')+' en '+esc(a.client)+'" aria-label="Explicación VP '+(v.k==='core'?'Core Evolution':'AI')+' en '+esc(a.client)+'"'+(canWrite?'':' disabled')+'>'+esc(vpNote(a.id,v.k))+'</textarea></td>';
        });
        body+='</tr>';
      });
    });
    $('tbody').innerHTML=body;
    var e=$('empty'), n=Object.keys(accounts).length;
    if(!loaded){e.hidden=false;e.innerHTML='<b>Cargando el plan…</b>Un momento.'}
    else if(!n){e.hidden=false;e.innerHTML='<b>Aún no hay cuentas en el plan</b>Añade la primera con su responsable debajo de la tabla.'}
    else if(!r.names.length){e.hidden=false;e.innerHTML='<b>Ninguna cuenta cumple los filtros</b>Cambia el responsable, la VP o el estado.'}
    else e.hidden=true;
    $('addrow').style.display=canWrite?'':'none';
  }

  var pop=null, popId=null, popKey=null;
  function closePop(){
    if(!pop) return;
    var ta=pop.querySelector('textarea'), id=popId, key=popKey;
    pop.parentNode.removeChild(pop); pop=null; popId=null; popKey=null;
    if(ta&&canWrite){var x=getTask(id,key); if(ta.value!==(x.note||'')) setTask(id,key,{note:ta.value})}
  }
  function openPop(btn){
    var same=pop&&popId===btn.dataset.id&&popKey===btn.dataset.k; closePop(); if(same) return;
    var id=btn.dataset.id, key=btn.dataset.k, x=getTask(id,key);
    pop=document.createElement('div'); pop.className='pop'; popId=id; popKey=key;
    pop.innerHTML='<div class="pt">'+esc(btn.dataset.title)+'</div>'+
      '<label class="pk"><input type="checkbox" id="pv-pk"'+(x.parked?' checked':'')+(canWrite?'':' disabled')+'> Aparcada (bloquea estado y fecha)</label>'+
      '<textarea id="pv-pn" rows="4" placeholder="Cómo abordar la VP en esta cuenta"'+(canWrite?'':' disabled')+'>'+esc(x.note||'')+'</textarea>'+
      '<div class="pa"><button type="button" class="btn" id="pv-pc">Cerrar</button></div>';
    var root=document.getElementById('pv'), rr=root.getBoundingClientRect(), br=btn.getBoundingClientRect();
    root.appendChild(pop);
    var left=Math.max(0,Math.min(br.left-rr.left-230,rr.width-pop.offsetWidth)), top=br.bottom-rr.top+4;
    pop.style.left=left+'px'; pop.style.top=top+'px';
    pop.querySelector('#pv-pk').addEventListener('change',function(ev){setTask(id,key,{parked:ev.target.checked})});
    pop.querySelector('#pv-pc').addEventListener('click',closePop);
    pop.querySelector('textarea').focus();
  }
  document.addEventListener('mousedown',function(ev){if(pop&&!pop.contains(ev.target)&&!(ev.target.closest&&ev.target.closest('.nb')))closePop()});
  document.addEventListener('keydown',function(ev){if(ev.key==='Escape')closePop()});
  $('tbody').addEventListener('change',function(ev){
    var t=ev.target;
    if(t.dataset.amid){var a=accounts[t.dataset.amid]; if(a&&a.am!==t.value.trim()){a.am=t.value.trim();a.amSrc='';saveAccount(t.dataset.amid);render()}return}
    if(t.dataset.note){setNote(t.dataset.id,t.dataset.note,t.value);return}
    if(t.dataset.f){var p={};p[t.dataset.f]=(t.type==='checkbox')?t.checked:t.value;setTask(t.dataset.id,t.dataset.k,p)}
  });
  var pendingDel=null;
  $('tbody').addEventListener('click',function(ev){
    var nb=ev.target.closest('.nb'); if(nb){openPop(nb);return}
    var b=ev.target.closest('[data-del]'); if(!b) return;
    var id=b.dataset.del;
    if(pendingDel===id){
      pendingDel=null; delete accounts[id]; delete plans[id];
      db.doc('accounts/'+id).delete().catch(function(){}); db.doc('plan/'+id).delete().catch(function(){});
      render();
    } else {pendingDel=id;b.textContent='¿Quitar?';b.style.color='var(--pv-venc)'; setTimeout(function(){if(pendingDel===id){pendingDel=null;render()}},3500)}
  });
  $('tbody').addEventListener('focusout',function(ev){if(pendingRender&&ev.target.dataset&&ev.target.dataset.note){setTimeout(function(){pendingRender=false;render()},0)}});
  ['fAm','fVp','fOla','fSt','fVenc'].forEach(function(i){$(i).addEventListener('change',render)});
  $('addBtn').addEventListener('click',function(){
    var name=$('newClient').value.trim(), am=$('newAm').value.trim();
    if(!name){$('newClient').focus();return}
    var id=slug(name); if(accounts[id]){setMsg('Esa cuenta ya está en el plan.',true);return}
    accounts[id]={client:name,am:am,amSrc:'',core:$('newCore').checked,ai:$('newAi').checked?{ola:'',caso:'',oferta:''}:null};
    saveAccount(id); $('newClient').value='';$('newAm').value='';setMsg('');render();
  });

  var loadTimer=setTimeout(function(){if(!loaded)setMsg('Los datos tardan en llegar. Sigo intentándolo.',true)},10000);
  function start(){
    claude.use('db').then(function(d){
      if(!d){loaded=true;canWrite=false;setMsg('Esta vista no puede leer el plan guardado.',true);render();return}
      db=d;
      db.collection('accounts').onSnapshot(function(s){
        var m={};s.docs.forEach(function(x){var v=x.data();if(v&&v.client)m[x.id]=v});
        accounts=m; window.__mlpAcc=Object.keys(m).map(function(k){return {client:m[k].client,am:(m[k].am||'').trim()}}); try{document.dispatchEvent(new Event('mlp-acc'))}catch(e){} loaded=true; clearTimeout(loadTimer); setMsg(''); render();
      },function(e){loaded=true;setMsg('No se pudo leer las cuentas ('+(e&&e.code)+').',true);render()});
      db.collection('plan').onSnapshot(function(s){
        var m={};s.docs.forEach(function(x){m[x.id]=x.data()});
        plans=m; render();
      },function(e){setMsg('No se pudo leer las tareas ('+(e&&e.code)+').',true)});
    }).catch(function(){loaded=true;render()});
    claude.use('user').then(function(u){
      if(u&&u.can){Promise.resolve(u.can('data.write')).then(function(ok){if(ok===false){canWrite=false;render()}}).catch(function(){})}
    }).catch(function(){});
  }
  render();
  if(window.claude&&claude.use) start(); else {loaded=true;setMsg('El guardado compartido no está disponible en esta vista.',true);render()}
})();

