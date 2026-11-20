# Market Leader · Seguimiento v2

App estática (sin compilar) + Supabase. Pestañas: **Cuadro de mando**, **Tareas**, **Cuentas**.
Una tarea = una fecha límite. Los recordatorios salen **dentro de la app** (aviso al abrir + contadores en la cabecera + colores por urgencia).
Etapas por cuenta y VP: Sin contacto → **Solicitar fecha de reunión** → Reunión → VP presentada → Propuesta → Ganada / Perdida / Aparcada / No aplica.

## Pasos (≈15 min)

### 1. Supabase: ejecutar la migración
1. Supabase → tu proyecto → **SQL Editor → New query**.
2. Pega **todo** el contenido de `supabase/migration_v2.sql` → **Run**.
3. Al final devuelve una fila con recuentos. Esperado: `cuentas` = 34, `etapas` = 136, `tareas` ≈ 21 (las 3 tareas por cuenta del modelo antiguo que tenían fecha/estado), `personas` ≈ 12.
4. Si ves un error de "function has_profile() does not exist", el esquema v1 no se ejecutó en este proyecto: ejecuta antes `supabase/schema.sql` de la v1.
5. Es seguro relanzarla: si `ml_accounts` ya tiene datos, no duplica. Las tablas antiguas (`accounts`, `plan`, `tasks`) NO se tocan: quedan de copia de seguridad.
6. Opcional: **Table Editor** → comprueba que existen `ml_people`, `ml_accounts`, `ml_stages`, `ml_tasks`.

### 2. GitHub: sustituir los archivos
Repositorio `Market-Leader` → en la web de GitHub:
1. **Borrar** (abrir cada archivo → `…` → Delete file → Commit): `js/tasks.js`, `js/dashboard.js`, `styles.css`, `app.css` (los de la raíz). `js/app.js` no hace falta borrarlo: el nuevo lo sobrescribe.
2. **NO borres ni sobrescribas tu `config.js`** (tiene tus claves). `config.example.js` es solo una plantilla.
3. **Subir** (Add file → Upload files, arrastrando las carpetas conservando su estructura):
   - `index.html` (sobrescribe el anterior)
   - carpeta `css/` (contiene `app.css`)
   - carpeta `js/` (contiene `store.js`, `views.js`, `app.js`)
   - carpeta `supabase/` (opcional, solo documentación: `migration_v2.sql`)
   - `README.md`
4. Commit. GitHub Pages tarda 1–2 min en publicar. Abre la página con **Ctrl+F5** (para saltarte la caché).

Estructura final esperada:
```
index.html  config.js  README.md
css/app.css
js/store.js  js/views.js  js/app.js
supabase/migration_v2.sql
```

### 3. Comprobar
- Entras con tu usuario (rol admin). Cuadro de mando con datos; pestaña Cuentas con las 34 cuentas y su etapa en Core/AI.
- Si sale "No se pudieron leer los datos": falta ejecutar el paso 1. Pantalla en blanco: abre la consola (F12 → Console) y mira si hay un 404 en `js/…` o `css/…`.

### 4. Traer las tareas antiguas del artefacto (opcional)
En el artefacto del Market Leader, pestaña de tareas → **⬇ Exportar histórico** (JSON). En la app → Tareas → **⬆ Importar histórico**. Mapeo: fecha fin → fecha límite (se descarta la fecha inicio); *retrasada* → en curso (se calcula sola por fecha); las tareas de cuenta se vinculan por nombre de cuenta; si el responsable no existe en la lista, se anota en la nota; la tarea recurrente semanal se importa como una sola con la próxima fecha (repetir a mano).

## Actualización v3 (comentarios, eliminar, Configuración, KPI por cuenta)
1. **Supabase → SQL Editor → New query:** pega y ejecuta `supabase/migration_v3.sql` (después de la v2). Debe devolver `valores_de_lista` = 27 y `checks_restantes` = 0. Es relanzable y no toca datos.
2. **GitHub → sobrescribe:** `index.html`, `css/app.css`, `js/store.js`, `js/views.js` (no toques `config.js`). Opcional: sube también `supabase/migration_v3.sql`.
3. Recarga con Ctrl+F5. Nueva pestaña **Configuración**. Si no has ejecutado la migración, la app sigue funcionando con los valores por defecto y la pestaña te avisa.

## Logo y favicon
Archivos nuevos: carpeta `img/` (favicon.svg, favicon-16/32/48.png, apple-touch-icon.png, icon-192/512.png, logo.svg, logo.png) y `favicon.ico` en la raíz. `index.html` ya los enlaza. Súbelos a GitHub conservando la carpeta `img/`.

## Importar tareas (con vista previa)
Tareas → **Pegar tareas** (pega el JSON del agente, vale con el bloque de código completo) o **Importar archivo JSON**. Se abre una vista previa donde puedes editar, desmarcar o quitar cada tarea antes de guardar. Las que parecen duplicadas (mismo título) vienen desmarcadas.

## Limitaciones conocidas
- Sin Gantt ni calendario (decidido; el calendario queda para una fase posterior).
- Recordatorios solo con la app abierta: GitHub Pages no puede avisar con la app cerrada.
- Sin tiempo real: se recarga al volver a la pestaña (>1 min). Pensado para un único editor.
- No hay tareas recurrentes.
- Mantenimiento: listas de estados/etapas/VP en `js/store.js` (arriba del todo); si las cambias, ajusta también los `check` del SQL.
- Seguridad: nunca pongas la clave `service_role` en config.js; repo privado si es posible; confirma con IT de Inetum el alojamiento de datos de clientes en GitHub/Supabase personales.

## Subtareas (v4)
1. Copia de seguridad: Supabase > Table Editor > `ml_tasks` > Export CSV.
2. Ejecuta `supabase/migration_v4.sql` en el SQL Editor (todo lo existente pasa a ser tarea; su código es su número actual).
3. Sube a GitHub `js/store.js`, `js/views.js`, `css/app.css` (y este README). No toques tu `config.js`.
- Códigos: tarea `01`, subtarea `01-01`, `01-02`… Los números de subtarea no se reutilizan.
- Botones de fila: ＋ añadir subtarea · ↳ convertir en subtarea (pregunta de qué tarea cuelga) · ⇄ cambiar de tarea · ↱ convertir en tarea.
- Solo un nivel. Una tarea con subtareas no puede convertirse en subtarea.
- KPIs, «Carga por responsable» y «Vencen pronto» cuentan subtareas y tareas sin subtareas; embudo y «Tareas por cuenta», tareas.
