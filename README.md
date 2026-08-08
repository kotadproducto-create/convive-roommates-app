# Convive — Gestión de tareas del piso entre roommates

App para repartir y llevar el control de las tareas fijas de un piso compartido
(compras, basura, lavadora), con muro de incidencias, notificaciones internas
y un sistema de puntos/recompensas.

## Estado actual: conectado a Supabase real

Esta versión ya usa **Supabase** de verdad (Postgres + Auth + Storage +
Realtime) en vez de datos guardados solo en el navegador. Eso significa que
todos los roommates comparten los mismos datos desde sus propios dispositivos.

Los archivos `*.old.js` / `*.old.jsx` que verás sueltos por el proyecto son
la versión anterior (backend simulado en `localStorage`), guardada solo como
referencia. No se usan — puedes borrarlos con confianza si quieres.

## 1. Antes de nada: crear el proyecto en Supabase

1. Ve a **https://supabase.com** y crea una cuenta / inicia sesión.
2. "New project" → dale un nombre, una contraseña de base de datos (guárdala
   en algún sitio seguro) y elige la región más cercana.
3. Espera 1-2 minutos a que se aprovisione.

### 1.1 Crear las tablas
1. En el menú lateral, ve a **SQL Editor** → "New query".
2. Abre el archivo `supabase/schema.sql` de este proyecto, copia **todo** su
   contenido, pégalo en el editor de Supabase, y dale a **Run**.
3. Deberías ver "Success. No rows returned". Si da error, cópiame el mensaje.

### 1.2 Activar el bucket de fotos
1. Ve a **Storage** → "New bucket".
2. Nombre exacto: `incident-photos`. Márcalo como **público** (para que las
   fotos se puedan ver sin login adicional).
3. Crear.

### 1.3 Configurar autenticación
1. Ve a **Authentication → Providers → Email**.
2. Como esta app es para un grupo pequeño de confianza (tu piso), te
   recomiendo **desactivar "Confirm email"** para que la cuenta funcione al
   instante sin tener que ir a confirmar el correo. Está en esa misma
   pantalla ("Confirm email" toggle).
3. Guarda los cambios.

### 1.4 Copiar tus claves
1. Ve a **Settings → API**.
2. Copia el **Project URL** y la clave **anon public**.
3. Los necesitarás en el siguiente paso.

## 2. Configurar el proyecto en tu ordenador

1. En la carpeta del proyecto (`roomie-app`), duplica el archivo
   `.env.example` y renómbralo a **`.env`** (así, sin nada más).
2. Ábrelo y rellena solo estas dos líneas con lo que copiaste en el paso 1.4:
   ```
   VITE_SUPABASE_URL=https://tuproyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-clave-anon-publica
   ```
3. Guarda el archivo. (Este `.env` nunca se sube a GitHub — ya está en
   `.gitignore` — así que tus claves quedan solo en tu ordenador y luego se
   configuran aparte en Vercel).
4. En la terminal de VS Code, dentro de la carpeta del proyecto:
   ```
   npm install
   npm run dev
   ```
5. Abre `http://localhost:5173`, regístrate de nuevo (ahora las cuentas son
   reales, las de antes en localStorage no sirven aquí) y prueba a abrir una
   ventana de incógnito con otra cuenta usando el mismo código de piso —
   ahora sí deberían ver los mismos datos en tiempo real.

## 3. Subir el proyecto a GitHub

1. Crea una cuenta en **https://github.com** si no tienes.
2. En GitHub, botón verde "New repository" → nómbralo, por ejemplo,
   `convive-app` → **no** marques "Add a README" (ya tenemos uno) → Create.
3. En la terminal de VS Code, dentro de la carpeta del proyecto:
   ```
   git init
   git add .
   git commit -m "Primera versión de Convive"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/convive-app.git
   git push -u origin main
   ```
   (Si es la primera vez que usas Git, te pedirá configurar tu nombre/email:
   ```
   git config --global user.name "Tu Nombre"
   git config --global user.email "tu@email.com"
   ```
   y luego repites el `git push`.)
4. Si te pide iniciar sesión, sigue el flujo del navegador que te abre.
5. Refresca la página de tu repositorio en GitHub — deberías ver todos los
   archivos ahí (menos `node_modules` y `.env`, que se excluyen a propósito).

## 4. Desplegar en Vercel

1. Ve a **https://vercel.com** y crea cuenta con tu mismo usuario de GitHub
   (botón "Continue with GitHub").
2. "Add New..." → "Project" → busca y selecciona tu repo `convive-app` →
   "Import".
3. Vercel detecta automáticamente que es un proyecto Vite, no cambies nada
   en "Build settings".
4. Antes de darle a Deploy, abre **"Environment Variables"** y añade las dos
   mismas variables de tu `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Dale a **Deploy**. Tarda 1-2 minutos.
6. Al terminar te da una URL tipo `convive-app.vercel.app` — esa es la que
   compartes con tus roommates. Pruébala desde el móvil también.

## 5. ¿Se puede seguir modificando después de desplegado?

**Sí, sin ningún problema**, y de hecho es el flujo normal:

- Sigues trabajando en tu ordenador exactamente igual que ahora (editas
  archivos, `npm run dev` para ver los cambios en local).
- Cuando quieras que el cambio llegue a la web pública, subes los cambios a
  GitHub:
  ```
  git add .
  git commit -m "Descripción del cambio"
  git push
  ```
- **Vercel se entera solo.** Cada vez que haces `push` a la rama `main`,
  Vercel detecta el cambio automáticamente y vuelve a desplegar la web con
  la versión nueva, sin que tengas que volver a su web para nada. En 1-2
  minutos tus roommates ya ven la versión actualizada.
- Si algún día quieres cambiar algo de la base de datos (una tabla nueva,
  una columna nueva), eso se hace en Supabase → SQL Editor, igual que
  hiciste con `schema.sql` la primera vez.

Dicho de otra forma: GitHub es donde vive el código "oficial", y Vercel
publica automáticamente lo último que haya en GitHub. Tú solo tienes que
acordarte de hacer `git push` cuando termines un cambio que quieras publicar.

## 6. Decisiones de diseño

| Decisión | Qué hice |
|---|---|
| **Seguridad de datos (RLS)** | Cada tabla tiene políticas para que solo se vean/editen los datos del propio piso (`floor_id` coincide con el piso del usuario). Los roles admin/miembro se controlan en la interfaz, no a nivel de base de datos — para un piso pequeño de confianza es suficiente. |
| **Fotos de incidencias** | Se suben al bucket `incident-photos` de Supabase Storage y se guarda solo la URL pública en la base de datos. |
| **Tiempo real** | Cada pantalla se suscribe a cambios de Postgres vía Supabase Realtime, así que si un roommate marca una tarea como hecha, el resto la ve actualizada sin recargar. |
| **Rotación semanal, puntos, colores/tipografía** | Igual que en la versión anterior — ver `src/lib/rotation.js` y `tailwind.config.js`. |

## 7. Qué falta / próximos pasos

- **Notificaciones por email/push reales**: hoy son solo internas (campana).
  Para email, la opción más simple es una Supabase Edge Function con Resend
  que se dispare cuando se inserte una fila en `notifications`. Para push,
  Firebase Cloud Messaging en paralelo a Supabase.
- **Exportar a Google Calendar/iCal**, **chat interno**, **estadísticas de
  cumplimiento**: mismas ideas de siempre, ahora con tablas reales de
  Supabase como base.

## 8. Estructura del proyecto

```
supabase/
  schema.sql          # tablas + seguridad (RLS) + realtime, para pegar en Supabase
src/
  lib/
    supabaseClient.js  # conexión a Supabase
    db.js              # funciones genéricas (get/create/update/remove/subscribe) sobre Supabase
    rotation.js         # lógica de rotación semanal de tareas
  context/
    AuthContext.jsx    # sesión real con Supabase Auth
    ThemeContext.jsx    # claro/oscuro
    DataContext.jsx     # datos del piso en tiempo real: miembros, tareas, incidencias, puntos
  components/            # Sidebar, Topbar, tarjetas, layout, ruta protegida
  pages/                  # Login, Register, Dashboard, Incidents, Rewards, FloorSettings
```
