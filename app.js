(function(){
  var $ = function(id){ return document.getElementById(id); };
  var cfg = window.ML_CONFIG || {};
  var TABLES = ['accounts','plan','tasks'];

  if(!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || /TU-PROYECTO|TU-CLAVE/.test(cfg.SUPABASE_URL + cfg.SUPABASE_ANON_KEY)){
    $('config-error').hidden = false; return;
  }
  if(!window.supabase){ $('login').hidden = false; $('login-msg').textContent = 'No se pudo cargar la librería de Supabase.'; return; }

  var sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  var role = 'viewer', userId = null, started = false;

  function canWrite(){ return role === 'admin' || role === 'editor'; }
  // Los errores de permisos (RLS) se mapean al código que espera el panel de seguimiento
  function mapErr(e){
    var denied = e && (e.code === '42501' || /row-level security|permission denied/i.test(e.message || ''));
    return { code: denied ? 'invalid_argument' : ((e && e.code) || 'error'), message: e && e.message };
  }

  // Adaptador con la misma interfaz que usa el panel: collection().onSnapshot(), doc().set()/delete()
  function makeDb(){
    function check(name){ if(TABLES.indexOf(name) < 0) throw new Error('Tabla no permitida: ' + name); }
    return {
      collection: function(name){
        check(name);
        return { onSnapshot: function(cb, errCb){
          var alive = true, timer = null;
          function load(){
            sb.from(name).select('id,data').then(function(r){
              if(!alive) return;
              if(r.error){ if(errCb) errCb(mapErr(r.error)); return; }
              cb({ docs: r.data.map(function(x){ return { id: x.id, data: function(){ return x.data; } }; }) });
            });
          }
          load();
          var ch = sb.channel('rt-' + name + '-' + Math.random().toString(36).slice(2))
            .on('postgres_changes', { event: '*', schema: 'public', table: name }, function(){ clearTimeout(timer); timer = setTimeout(load, 250); })
            .subscribe();
          return function(){ alive = false; sb.removeChannel(ch); };
        } };
      },
      doc: function(path){
        var p = String(path).split('/'), table = p[0], id = p[1];
        check(table);
        return {
          set: function(data){
            return sb.from(table).upsert({ id: id, data: data, updated_by: userId }).then(function(r){ if(r.error) throw mapErr(r.error); });
          },
          delete: function(){
            return sb.from(table).delete().eq('id', id).then(function(r){ if(r.error) throw mapErr(r.error); });
          }
        };
      }
    };
  }

  function exposeApi(){
    var db = makeDb();
    window.MLDB = { sb: sb, canWrite: canWrite, userId: userId };
    window.claude = { use: function(name){
      if(name === 'db') return Promise.resolve(db);
      if(name === 'user') return Promise.resolve({ can: function(){ return canWrite(); }, isOwner: function(){ return role === 'admin'; } });
      return Promise.resolve(null);
    } };
  }

  function loadScript(src){
    return new Promise(function(ok, ko){ var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ko; document.body.appendChild(s); });
  }

  async function enter(session){
    userId = session.user.id;
    var r = await sb.from('profiles').select('role,name').eq('id', userId).maybeSingle();
    role = (r.data && r.data.role) || 'viewer';
    $('ml-user').textContent = (session.user.email || '') + ' · ' + role;
    document.body.classList.toggle('readonly', !canWrite());
    $('login').hidden = true; $('app').hidden = false;
    if(started) return;
    started = true;
    exposeApi();
    await loadScript('js/dashboard.js');
    await loadScript('js/tasks.js');
    if(window.startMlpTasks) window.startMlpTasks();
  }

  $('login-form').addEventListener('submit', async function(ev){
    ev.preventDefault();
    $('login-msg').textContent = '';
    var r = await sb.auth.signInWithPassword({ email: $('login-email').value.trim(), password: $('login-pass').value });
    if(r.error){ $('login-msg').textContent = 'Acceso incorrecto: ' + r.error.message; return; }
    enter(r.data.session);
  });
  $('ml-logout').addEventListener('click', async function(){ await sb.auth.signOut(); location.reload(); });

  sb.auth.getSession().then(function(r){
    if(r.data && r.data.session) enter(r.data.session); else $('login').hidden = false;
  });
})();
