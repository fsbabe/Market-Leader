# Market Leader Plan — app de seguimiento

App web estática (HTML + JS, sin compilar) con tres pestañas: **Listado de tareas**, **Diagrama de Gantt** y **Seguimiento VP por AM**.
Los datos viven en **Supabase** (Postgres + login + tiempo real); el código vive en **GitHub**.

> Estado: probada con un Supabase simulado (login, lectura, escritura, borrado, solo lectura). **No se ha probado contra un proyecto Supabase real ni se ha ejecutado el SQL**: haz la prueba de la sección 5 antes de usarla con datos reales.

## 1. Crear el proyecto Supabase
1. Crea un proyecto en supabase.com (región UE, p. ej. Frankfurt, si hay requisitos de RGPD).
2. **Authentication → Sign In / Providers → Email**: desactiva el registro público de usuarios (para que solo entre quien tú invites).
3. **SQL Editor**: ejecuta `supabase/schema.sql` y después `supabase/seed.sql`.
4. **Authentication → Users**: crea tu usuario (y los de los AMs) con correo y contraseña. Hazlo *después* del paso 3 para que se cree su perfil automáticamente.
5. Súbete a administrador (SQL Editor):
   ```sql
   update public.profiles set role = 'admin' where email = 'tu-correo@...';
   ```
   Roles: `admin` y `editor` leen y escriben; `viewer` (por defecto) solo lee.

## 2. Configurar la app
En **Project Settings → API** copia la *Project URL* y la clave *anon / publishable* a `config.js`.
La clave anon es pública por diseño; la seguridad la dan el login y las políticas RLS. **Nunca pongas la clave `service_role`.**

## 3. Probar en local
```bash
python3 -m http.server 8000     # dentro de esta carpeta
# abre http://localhost:8000
```

## 4. GitHub y publicación
```bash
git init && git add . && git commit -m "Market Leader Plan"
git branch -M main
git remote add origin git@github.com:TU-USUARIO/market-leader-plan.git   # repo PRIVADO
git push -u origin main
```
Publicación (sin paso de build, directorio raíz): **Vercel** o **Netlify** importando el repo, o GitHub Pages. Con repo privado, GitHub Pages puede exigir un plan de pago (verifícalo en tu cuenta).

## 5. Prueba mínima con datos reales
1. Entra con tu usuario: deben verse 34 cuentas y la tarea semanal.
2. Edita una nota o un estado, recarga: debe seguir ahí.
3. Abre la app en otra ventana: el cambio debe llegar solo (tiempo real).
4. Entra con un usuario `viewer`: debe verse en solo lectura y no guardar.

## 6. Pasar las tareas del artefacto
En el artefacto, pestaña *Listado de tareas* → **⬇ Exportar histórico**. En la app → **⬆ Importar histórico** (reemplaza las tareas actuales).

## Estructura de datos
Tres tablas con una fila por documento (`id`, `data jsonb`): `accounts` (cuentas, AM, ola de IA), `plan` (estado, fecha y nota de cada tarea por cuenta y VP) y `tasks` (listado de tareas). Es la forma más directa de portar el artefacto; si más adelante necesitas informes, se puede normalizar a columnas.

## Seguridad y datos
- Los datos son comerciales de Inetum: confirma con IT/seguridad que pueden alojarse en tu GitHub y tu Supabase antes de cargar datos reales. Repo privado.
- `supabase-js` se carga desde jsDelivr con la versión fijada (`2.45.4`): verifica que sigue disponible y actualízala si procede.
