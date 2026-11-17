/* Arranque: configuración, login (Supabase Auth), carga de datos y navegación. */
(function(){
  'use strict';
  var ML = window.ML, $ = function(id){ return document.getElementById(id); };
  window.__mlBooted = true; $('boot').hidden = true;
  var cfg = window.ML_CONFIG || {};
  if(!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || /TU-PROYECTO|TU-CLAVE/.test(cfg.SUPABASE_URL + cfg.SUPABASE_ANON_KEY)){ $('config-error').hidden = false; return; }
  if(!window.supabase){ $('login').hidden = false; $('login-msg').textContent = 'No se pudo cargar la librería de Supabase (red o bloqueo del CDN).'; return; }
  var sb = ML.sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  var started = false;

  async function enter(session){
    var r = await sb.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
    var role = (r.data && r.data.role) || 'viewer';
    ML.canWrite = role === 'admin' || role === 'editor';
    document.body.classList.toggle('readonly', !ML.canWrite);
    $('who-user').textContent = (session.user.email || '') + ' · ' + role;
    $('login').hidden = true; $('app').hidden = false;
    if(started) return; started = true;
    if(await ML.load()){ ML.render(); ML.showReminders(); }
    else { $('view').innerHTML = '<div class="panel"><h2>No se pudieron leer los datos</h2><p>¿Has ejecutado <code>migration_v2.sql</code> en Supabase? (ver README, paso 3).</p></div>'; }
  }

  $('login-form').addEventListener('submit', async function(e){
    e.preventDefault(); $('login-msg').textContent = '';
    var r = await sb.auth.signInWithPassword({ email: $('login-email').value.trim(), password: $('login-pass').value });
    if(r.error) $('login-msg').textContent = 'Acceso incorrecto: ' + r.error.message;
  });
  $('btn-out').onclick = async function(){ await sb.auth.signOut(); location.reload(); };
  $('tabs').addEventListener('click', function(e){ var b = e.target.closest('[data-tab]'); if(b) ML.setTab(b.dataset.tab); });

  // Recarga al volver a la pestaña (un solo usuario edita; así se ven cambios hechos desde otro dispositivo)
  document.addEventListener('visibilitychange', async function(){
    if(document.visibilityState !== 'visible' || !started || Date.now() - (ML.loadedAt || 0) < 60000) return;
    var a = document.activeElement; if(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
    if(await ML.load()) ML.render();
  });

  sb.auth.getSession().then(function(r){
    if(r.data && r.data.session) enter(r.data.session); else $('login').hidden = false;
  });
  sb.auth.onAuthStateChange(function(ev, session){ if(ev === 'SIGNED_IN' && session) enter(session); });
})();
