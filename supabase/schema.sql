-- =========================================================
-- Convive — Esquema de base de datos para Supabase
-- =========================================================
-- Cómo usar: Supabase Dashboard → tu proyecto → "SQL Editor"
-- → "New query" → pega todo este archivo → "Run".
--
-- ATENCIÓN: este archivo empieza con DROP TABLE de todo el
-- esquema anterior. Se puede hacer porque todavía no hay
-- roommates reales usando la app (solo cuenta de prueba).
-- Se puede ejecutar una sola vez de golpe.
-- =========================================================

drop table if exists coin_transactions cascade;
drop table if exists redemptions cascade;
drop table if exists notifications cascade;
drop table if exists incidents cascade;
drop table if exists tasks cascade;
drop table if exists floor_memberships cascade;
drop table if exists floors cascade;
drop table if exists profiles cascade;
drop function if exists my_floor_id();
drop function if exists is_active_member(uuid);
drop function if exists is_floor_admin(uuid);

-- Tabla de perfiles: extiende auth.users (que gestiona Supabase)
-- con los datos propios de la app. Un perfil ya NO tiene un piso
-- ni un rol fijos: eso vive en floor_memberships, porque un
-- usuario puede pertenecer a varios pisos a lo largo del tiempo
-- (uno activo a la vez, el resto en historial).
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  nickname text,
  age integer check (age is null or (age > 0 and age < 130)),
  phone text,
  interests text, -- gustos/intereses, tarjeta de Convives y Perfil
  occupation text, -- "a qué se dedica" (opcional), tarjeta de Convives y Perfil
  allergies text, -- alergias/restricciones alimentarias; siempre visible para el piso (info de seguridad, no de privacidad), a diferencia de los campos *_public de abajo
  avatar_url text,
  color text, -- color de identidad elegido en Perfil (círculo de roomies en Inicio); si es null, la app usa un color de respaldo derivado del id
  age_public boolean not null default true, -- privacidad de presentación (no RLS): oculta la edad a otros en Convives
  phone_public boolean not null default true, -- ídem para el teléfono
  occupation_public boolean not null default true, -- ídem para la ocupación
  tutorial_enabled boolean not null default false, -- "Modo tutorial": true = se muestra el tutorial guiado (AppTutorial). Se pone en true al registrarse y desde Configuración; al terminarlo o cerrarlo vuelve a false. Default false para no afectar cuentas existentes.
  onboarding_seen boolean not null default true, -- si ya vio /bienvenida; nuevo default true para no afectar cuentas existentes, se pone false explícito al registrarse
  points integer not null default 0,
  reputation_score numeric not null default 0, -- automática, no transferible, calculada desde el historial de tareas en todos los pisos (sin lógica todavía, Fase 1+)
  presentation_message text check (char_length(presentation_message) <= 240), -- Bio de la tarjeta de "Convives"; único de perfil, se reutiliza al unirse a cualquier piso
  created_at timestamptz not null default now()
);

create table if not exists floors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  rotation_order uuid[] not null default '{}',
  -- Modo de "Orden de rotación" (Tu piso): 'random' (por defecto,
  -- compatible con el comportamiento de siempre — cada actividad avanza
  -- el turno según SU PROPIA frecuencia) o 'period' (Determinado: el
  -- turno completo avanza según una cadencia única de piso, ver
  -- globalPeriodIndex en lib/activities.js). rotation_epoch es la fecha
  -- de referencia de esa cadencia — se resetea cada vez que el orden o
  -- el período cambian de verdad, para que el conteo arranque limpio.
  rotation_mode text not null default 'random' check (rotation_mode in ('random', 'period')),
  rotation_period_unit text check (rotation_period_unit in ('day', 'week', 'month', 'year')),
  rotation_period_interval integer not null default 1,
  rotation_epoch date,
  pot_amount numeric not null default 0,
  pot_threshold numeric not null default 30,
  pot_per_person numeric not null default 10,
  whatsapp_group_url text,
  notes text, -- nota compartida del piso, editable por cualquier miembro (ver /actividades)
  notes_updated_by uuid references profiles(id) on delete set null,
  notes_updated_at timestamptz,
  -- Sobrescritura opcional de nombre/puntos de las 3 tareas fijas
  -- (compras/basura/lavadora, ver rotation.js), por piso. Forma:
  -- { compras: { title, points }, basura: {...}, lavadora: {...} } —
  -- cualquier clave ausente usa el valor por defecto de TASK_TYPES/i18n.
  -- La rotación en sí (quién le toca, qué día) no pasa por acá.
  fixed_task_overrides jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Membresías: historial de pertenencia de un usuario a pisos.
-- Como mucho una fila 'active' por usuario (constraint de BD más
-- abajo). 'pending' se usa tanto para reactivar una membresía 'left'
-- como para la solicitud de un usuario nuevo que se une con un código
-- de invitación (flujo de admisión: cualquier miembro activo del piso
-- puede aceptarla a 'active' o denegarla a 'rejected', que queda en
-- el historial para auditoría).
create table if not exists floor_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  floor_id uuid not null references floors(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  status text not null default 'active' check (status in ('active', 'left', 'pending', 'rejected')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  pot_active boolean not null default true, -- baja temporal del reparto del pote (viaje, etc.); no afecta la membresía real del piso. Se muestra como "Fuera del piso" en la tarjeta de Convives (invertido: fuera = pot_active false)
  away_until date, -- hasta qué fecha vuelve, puesta por "Estoy fuera" en Convives; null = sin fecha conocida, o ya está en el piso. Un efecto en DataContext.jsx reactiva pot_active solo al pasar esta fecha.
  active_status boolean not null default true, -- indicador informativo de presencia en el piso ("Convives"); ya no se usa en la UI, se deja por si hiciera falta
  first_seen_by uuid references profiles(id), -- quién de los miembros activos "reclamó" primero el pop-up de esta solicitud pendiente (para no mostrarla a todos a la vez)
  removal_requested_by uuid references profiles(id), -- salida iniciada por un admin: pendiente hasta que el propio afectado la confirme (o el admin la cancele). La salida voluntaria no usa esto, es instantánea.
  removal_requested_at timestamptz
);

create unique index if not exists floor_memberships_one_active_per_user
  on floor_memberships (user_id)
  where status = 'active';

create index if not exists floor_memberships_floor_status_idx
  on floor_memberships (floor_id, status);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references floors(id) on delete cascade,
  week_key text not null,
  type text not null, -- 'compras' | 'basura' | 'lavadora'
  assigned_user_id uuid references profiles(id) on delete set null,
  completed boolean not null default false,
  completed_at timestamptz,
  reassigned boolean not null default false,
  created_at timestamptz not null default now()
);

-- Evita tareas duplicadas del mismo tipo en la misma semana del mismo
-- piso, aunque ensureWeekTasks() se dispare dos veces a la vez (efecto
-- de React re-ejecutado, dos pestañas abiertas, StrictMode, etc.)
create unique index if not exists tasks_floor_week_type_idx
  on tasks (floor_id, week_key, type);

create table if not exists incidents (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references floors(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  author_name text not null,
  title text not null,
  description text,
  photo_url text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references floors(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null, -- null = para todo el piso
  type text not null, -- 'turno' | 'pote' | 'lavadora'
  week_key text,
  read boolean not null default false,
  message text not null,
  created_at timestamptz not null default now()
);

-- Notificaciones push (OneSignal): cada INSERT en notifications dispara
-- la Edge Function notify-push vía pg_net. El secreto compartido con esa
-- función se lee de Supabase Vault (nunca queda en texto plano aquí) —
-- ver supabase/functions/notify-push y el paso "vault.create_secret(...)"
-- que se corre una sola vez desde el SQL Editor.
create extension if not exists pg_net;

create or replace function public.notify_push_on_notification()
returns trigger
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  webhook_secret text;
begin
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets
  where name = 'notify_push_webhook_secret';

  perform net.http_post(
    url := 'https://troidfaunaliukrgtywc.supabase.co/functions/v1/notify-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    body := jsonb_build_object('type', 'INSERT', 'table', 'notifications', 'record', to_jsonb(new))
  );
  return new;
end;
$$;

drop trigger if exists notify_push_trigger on public.notifications;
create trigger notify_push_trigger
  after insert on public.notifications
  for each row
  execute function public.notify_push_on_notification();

create table if not exists redemptions (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references floors(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  user_name text not null,
  reward_key text not null,
  reward_label text not null,
  cost numeric not null,
  created_at timestamptz not null default now()
);

-- Ledger inmutable de "Convis" (moneda gastable, local a cada piso,
-- no se lleva al cambiar de piso). Nunca hay un campo editable
-- directo de saldo: el saldo siempre se deriva sumando esta tabla.
-- No tiene lógica ni UI todavía (Fase 1+); aquí solo se deja la
-- tabla y sus políticas de solo select/insert (ni siquiera el
-- propio autor puede editar o borrar una fila ya escrita).
create table if not exists coin_transactions (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references floors(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  amount numeric not null, -- positivo = ingreso, negativo = gasto
  reason text,
  created_at timestamptz not null default now()
);

-- Ledger de movimientos (EUR) del pote de compras compartido. Inmutable
-- para los aportes; los gastos son editables/borrables por su autor
-- durante 24h (ver política RLS más abajo). floors.pot_amount sigue
-- siendo el total rápido de mostrar; esta tabla es el historial:
-- positivo = aporte, negativo = gasto. Los gastos llevan nota/foto de
-- factura opcionales y NO cuentan en el saldo personal de nadie (son
-- gasto del grupo, no una deuda de quien lo registra).
create table if not exists pot_contributions (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references floors(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  amount numeric not null, -- positivo = aporte, negativo = gasto
  -- 'adjustment' = ajuste manual del Pote aprobado por TODO el piso (ver
  -- requestPotAdjustment en DataContext.jsx): `amount` es la diferencia
  -- que se aplicó (nuevo importe − importe anterior), y NO cuenta como
  -- aporte ni gasto de nadie (ni para el saldo personal ni para "ya
  -- participó en el pote").
  kind text not null default 'contribution' check (kind in ('contribution', 'adjustment')),
  -- Solo en gastos: ids de quienes se repartieron ese gasto (todos menos
  -- los que estaban "fuera" al hacerse). Null en gastos viejos = se
  -- reparte entre todos los que ya estaban en el piso (ver lib/wallets.js).
  split_among uuid[],
  note text,
  receipt_url text,
  created_at timestamptz not null default now()
);

-- Lista de compras del piso: productos recurrentes/puntuales con control
-- de stock (semáforo ok/low/out).
create table if not exists shopping_items (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references floors(id) on delete cascade,
  name text not null,
  store text,
  store_location text,
  usual_quantity text,
  stock_level text not null default 'ok' check (stock_level in ('ok', 'low', 'out')),
  recurring boolean not null default true,
  estimated_price numeric,
  image_url text,
  note text check (char_length(note) <= 300), -- detalles libres del producto (marca, variante, dónde encontrarlo...)
  link_url text, -- URL al producto en la web del supermercado
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shopping_items_floor_idx on shopping_items (floor_id);
-- Para que Realtime entregue los DELETE con el filtro por floor_id (si no, un
-- producto borrado en otro dispositivo no desaparece hasta recargar).
alter table shopping_items replica identity full;

-- Ledger inmutable de compras realizadas. item_name copia el nombre al
-- momento de comprar (el historial sigue legible aunque el producto se
-- edite o borre luego); pot_contribution_id enlaza opcionalmente con un
-- gasto ya registrado en el pote de dinero.
create table if not exists shopping_purchases (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references floors(id) on delete cascade,
  item_id uuid references shopping_items(id) on delete set null,
  item_name text not null,
  user_id uuid not null references profiles(id) on delete cascade,
  price numeric,
  pot_contribution_id uuid references pot_contributions(id) on delete set null,
  session_id uuid, -- se agrega la FK real más abajo, después de crear purchase_sessions
  created_at timestamptz not null default now()
);

create index if not exists shopping_purchases_floor_idx on shopping_purchases (floor_id);

-- Agrupa varias filas de shopping_purchases de un mismo "viaje" de
-- compra (modo "Hacer la compra"): el monto total y la foto del ticket
-- NO se duplican aquí, viven en la fila de pot_contributions que ya crea
-- addPotExpense — esta tabla solo agrupa qué productos fueron parte de
-- esa compra.
create table if not exists purchase_sessions (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references floors(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  pot_contribution_id uuid references pot_contributions(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table shopping_purchases add constraint shopping_purchases_session_id_fkey
  foreign key (session_id) references purchase_sessions(id) on delete set null;

-- Solicitudes de "estar fuera del piso" (ausencia temporal con fechas,
-- aprobada o rechazada por un admin). Al aprobarse, excluye a la persona
-- del pote (reutiliza pot_active) y de la generación de tareas de la
-- semana en curso (whoIsAssigned salta a la siguiente persona).
create table if not exists absence_requests (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references floors(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled', 'completed')),
  decided_by uuid references profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists absence_requests_floor_idx on absence_requests (floor_id);

-- Pareja de habitacion: dos miembros del piso se emparejan por
-- consentimiento mutuo (uno invita, el otro confirma). Una vez
-- aceptada, las notificaciones dirigidas a uno tambien le llegan al
-- otro (logica en DataContext.jsx, no aqui).
create table if not exists room_partners (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references floors(id) on delete cascade,
  requester_id uuid not null references profiles(id) on delete cascade,
  partner_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','accepted','rejected','cancelled')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

-- Votaciones (Consultas): cualquier miembro propone una pregunta con
-- 2-4 opciones para que el resto vote. `options` va como array plano
-- (mismo espíritu que activities.weekdays) en vez de una tabla aparte
-- — no hace falta más que el texto de cada opción. `resolution_mode`
-- 'majority' (por defecto, mayoría simple en cuanto vota todo el
-- mundo activo) o 'unanimity' (todos deben elegir la misma opción).
-- La resolución NO la decide un admin: es automática, ver
-- resolvePoll() en src/lib/polls.js y el efecto que la invoca en
-- DataContext.jsx (mismo patrón oportunista que expira
-- absence_requests, sin cron).
create table if not exists polls (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references floors(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,
  question text not null check (char_length(question) <= 240),
  options text[] not null check (array_length(options, 1) between 2 and 4),
  resolution_mode text not null default 'majority' check (resolution_mode in ('majority', 'unanimity')),
  deadline date,
  -- 'kind' distingue las consultas normales (cualquier roommate,
  -- 'custom') de las que genera el propio sistema para pedir aprobación
  -- de un cambio de orden de rotación ('rotation_order', ver
  -- proposeRotationOrder en DataContext.jsx); 'payload' guarda los datos
  -- que aplicar si se aprueba (ej. {newOrder:[...]}). 'deadline_at' es un
  -- plazo con hora exacta (no solo fecha) para cuando el plazo en horas de
  -- verdad importa — las consultas normales siguen usando 'deadline'.
  kind text not null default 'custom' check (kind in ('custom', 'rotation_order', 'pot_adjustment', 'balance_reset')),
  payload jsonb,
  deadline_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'resolved', 'closed', 'expired')),
  resolved_option text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists polls_floor_idx on polls (floor_id);

-- Un voto por persona por consulta (unique) — re-votar es un UPDATE de
-- la fila propia, no una fila nueva. `floor_id` va denormalizado
-- (mismo patrón que shopping_purchases) para que subscribeTable pueda
-- filtrar por piso sin un join.
create table if not exists poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls(id) on delete cascade,
  floor_id uuid not null references floors(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  option text not null,
  created_at timestamptz not null default now(),
  unique (poll_id, user_id)
);
create index if not exists poll_votes_floor_idx on poll_votes (floor_id);
create index if not exists poll_votes_poll_idx on poll_votes (poll_id);

-- "Reiniciar saldo" (Pote → Saldo por persona): fija el saldo de UNA persona
-- en new_balance sin tocar el total del Pote ni a nadie más. scope 'self' =
-- reinicio individual, se aplica al instante; 'poll' = la persona aprobó una
-- consulta "para todos" (poll_id, kind 'balance_reset') y se aplica solo a su
-- propio saldo. Ledger inmutable: solo se inserta la fila propia
-- (user_id = auth.uid()), sin update ni delete.
create table if not exists wallet_resets (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references floors(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  new_balance numeric not null,
  scope text not null check (scope in ('self', 'poll')),
  poll_id uuid references polls(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists wallet_resets_floor_idx on wallet_resets (floor_id);

-- "Espacios compartidos" (Actividades): elementos de uso común del piso que se
-- avisan con "Voy a usarla". Un uso = quién, desde cuándo y hasta cuándo; el
-- espacio figura "en uso" mientras haya un uso sin liberar (released_at) cuyo
-- ends_at no haya pasado — se calcula con la hora actual, no hay cron.
-- space_key es libre ('washer' hoy): un espacio nuevo no necesita migración.
create table if not exists shared_space_uses (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references floors(id) on delete cascade,
  space_key text not null,
  user_id uuid not null references profiles(id) on delete cascade,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  released_at timestamptz, -- "Ya terminé": libera el espacio antes de que venza ends_at
  created_at timestamptz not null default now()
);
create index if not exists shared_space_uses_floor_space_idx on shared_space_uses (floor_id, space_key, ends_at);

-- Gestor de actividades del piso — incluye tanto las actividades
-- propias como las 3 "fijas" (Compras/Basura/Lavadora, identificadas
-- por `fixed_key`, no borrables, con `points`): recurrentes (cada N
-- días/semanas/meses, con días de la semana elegibles si es semanal)
-- o de una sola vez con fecha — asignación manual (incluye "Todos",
-- assigned_user_id null) o por rotación automática (rotationOrder del
-- piso). El motor viejo (tasks + rotation.js) queda solo como
-- historial de antes de esta migración. Ver src/lib/activities.js.
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references floors(id) on delete cascade,
  title text not null,
  fixed_key text, -- 'compras' | 'basura' | 'lavadora' | null (propia); no editable desde la UI, no borrable si está seteado
  points integer, -- solo relevante para las fijas; null = esta actividad no otorga puntos
  frequency_type text not null check (frequency_type in ('recurring','once')),
  recurrence_unit text check (recurrence_unit in ('day','week','month')), -- solo si frequency_type = 'recurring'
  recurrence_interval integer not null default 1, -- "cada N días/semanas/meses"
  weekdays integer[], -- 0=lunes..6=domingo; solo si recurrence_unit = 'week' (también define en qué día del Calendario aparece)
  start_date date not null default current_date, -- ancla para calcular qué días/semanas/meses son "ocurrencia" cuando recurrence_interval > 1
  until_date date, -- fin opcional de la recurrencia
  times_per_week integer check (times_per_week is null or (times_per_week between 1 and 7)), -- contador del stepper; se deriva de weekdays al crear/editar
  specific_date date, -- solo si frequency_type = 'once'
  assignment_mode text not null default 'manual' check (assignment_mode in ('manual','rotation')),
  assigned_user_id uuid references profiles(id) on delete set null, -- solo si assignment_mode = 'manual'; null = "Todos"
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Registro de cumplimiento por período (semana/mes/fecha única) de
-- cada actividad — mismo espíritu que "tasks" para el sistema fijo.
create table if not exists activity_completions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  floor_id uuid not null references floors(id) on delete cascade,
  period_key text not null,
  assigned_user_id uuid references profiles(id) on delete set null, -- responsable de ESTE período (fijo en manual; va rotando en 'rotation')
  times_done integer not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (activity_id, period_key)
);
create index if not exists activities_floor_idx on activities (floor_id);
create index if not exists activity_completions_floor_idx on activity_completions (floor_id);
create index if not exists activity_completions_activity_idx on activity_completions (activity_id);

-- Cada vez que alguien marca una actividad: 'routine' = una ocasión
-- prevista de la rutina (suma al progreso, ver setActivityProgress);
-- 'extra' = una vez de más durante el turno, solo reconocimiento (sin
-- puntos, no afecta la rutina). marked_by = quien lo hizo de verdad
-- (puede no ser el responsable del turno). replica identity full para
-- que Realtime sí entregue los borrados con el filtro por piso.
create table if not exists activity_marks (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references floors(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  completion_id uuid not null references activity_completions(id) on delete cascade,
  marked_by uuid references profiles(id) on delete set null,
  -- 'routine' = ocasión marcada como hecha; 'undo' = anula la marca vigente
  -- más reciente (no se borra nada: queda en el historial); 'extra' = solo
  -- reconocimiento. points = puntos que movió la marca (negativos en 'undo').
  kind text not null default 'routine' check (kind in ('routine', 'extra', 'undo')),
  points integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists activity_marks_floor_idx on activity_marks (floor_id);
create index if not exists activity_marks_completion_idx on activity_marks (completion_id);
alter table activity_marks replica identity full;

-- "Intercambiar turno" (Convives): target_type/target_id son
-- polimórficos (apuntan a una fila de tasks o de activity_completions
-- según el caso) — sin FK cruzada, se valida en la app. No es
-- instantáneo: se propone y la otra persona acepta/rechaza, mismo
-- espíritu que room_partners.
create table if not exists swap_requests (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references floors(id) on delete cascade,
  target_type text not null check (target_type in ('task','activity_completion')),
  target_id uuid not null,
  from_user_id uuid not null references profiles(id) on delete cascade,
  to_user_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists swap_requests_floor_idx on swap_requests (floor_id);
create index if not exists swap_requests_target_idx on swap_requests (target_type, target_id);

-- Registro interno de la Edge Function send-recovery-code: solo para
-- limitar cuántas veces se puede pedir un código por email en poco
-- tiempo (protección propia contra abuso, ya que este flujo no pasa por
-- /auth/v1/recover y por lo tanto no hereda el rate limit de Supabase).
-- Solo la propia función la toca (con la service_role key, que ignora
-- RLS) — RLS queda habilitado sin políticas para que nadie más, ni con
-- el anon key, pueda leer ni escribir aquí.
create table if not exists password_reset_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  requested_at timestamptz not null default now()
);
create index if not exists password_reset_attempts_email_idx on password_reset_attempts (email, requested_at desc);

-- =========================================================
-- Funciones auxiliares para RLS (security definer: pueden leer
-- floor_memberships sin quedar atrapadas por sus propias políticas)
-- =========================================================

create or replace function is_active_member(check_floor_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from floor_memberships
    where user_id = auth.uid()
      and floor_id = check_floor_id
      and status = 'active'
  );
$$;

create or replace function is_floor_admin(check_floor_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from floor_memberships
    where user_id = auth.uid()
      and floor_id = check_floor_id
      and status = 'active'
      and role = 'admin'
  );
$$;

-- =========================================================
-- Seguridad a nivel de fila (RLS)
-- Simplificación deliberada para un piso pequeño de confianza:
-- cualquier miembro activo de un piso puede leer/escribir los
-- datos de SU piso. Los roles (admin/miembro) ahora viven en
-- floor_memberships, no en profiles, porque un usuario puede ser
-- admin en un piso y miembro en otro.
-- =========================================================

alter table profiles enable row level security;
alter table floors enable row level security;
alter table floor_memberships enable row level security;
alter table tasks enable row level security;
alter table incidents enable row level security;
alter table notifications enable row level security;
alter table redemptions enable row level security;
alter table coin_transactions enable row level security;
alter table pot_contributions enable row level security;

-- profiles: ves tu propio perfil y el de cualquiera que comparta
-- contigo un piso activo; solo puedes crear/editar el tuyo; nunca
-- se borra un perfil (quitar a alguien de un piso es cerrar su
-- membresía, no borrar su perfil).
-- incluye 'pending' además de 'active' para poder mostrar el nombre de
-- quien solicita unirse en el pop-up de admisión, antes de ser aceptado.
create policy "select own or shared-floor profiles" on profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from floor_memberships fm
      where fm.user_id = profiles.id
        and fm.status in ('active', 'pending')
        and is_active_member(fm.floor_id)
    )
  );
create policy "insert own profile" on profiles
  for insert with check (id = auth.uid());
create policy "update own profile" on profiles
  for update using (id = auth.uid());
-- Permite a un admin del piso otorgar/restar Convis (profiles.points) a
-- cualquier miembro activo de su piso, sin depender de que sea su propio
-- perfil. Se combina con "update own profile" (RLS junta políticas
-- permisivas con OR).
create policy "floor admin update member points" on profiles
  for update using (
    exists (
      select 1 from floor_memberships fm
      where fm.user_id = profiles.id
        and fm.status = 'active'
        and is_floor_admin(fm.floor_id)
    )
  );

-- floors: cualquiera autenticado puede crear un piso nuevo
-- (todavía no tiene membresía asignada en ese momento);
-- solo ves/editas el tuyo una vez estás dentro.
create policy "insert any floor" on floors
  for insert with check (auth.uid() is not null);
create policy "select own floor" on floors
  for select using (is_active_member(id) or true); -- true: necesario para buscar por invite_code al unirse
create policy "update own floor" on floors
  for update using (is_active_member(id));

-- floor_memberships: ves tu propio historial completo (incluidas
-- membresías 'left'/'pending'), o el roster activo de cualquier
-- piso donde tú mismo seas miembro activo. Solo puedes crear tu
-- propia fila. Puedes actualizar la tuya propia (p.ej. pedir
-- reactivación); un admin del piso puede actualizar cualquier fila
-- del piso (cerrar membresías, aprobar reactivaciones, cambiar rol).
create policy "select own or floor memberships" on floor_memberships
  for select using (user_id = auth.uid() or is_active_member(floor_id));
create policy "insert own membership" on floor_memberships
  for insert with check (user_id = auth.uid());
create policy "update own membership" on floor_memberships
  for update using (user_id = auth.uid());
create policy "admin update floor memberships" on floor_memberships
  for update using (is_floor_admin(floor_id));
-- Cualquier miembro activo (no solo un admin) puede aceptar o rechazar una
-- solicitud 'pending' dirigida a su propio piso. El "with check" es más
-- laxo a propósito: tras decidir, la fila deja de tener status='pending',
-- así que esa condición no puede repetirse para la fila resultante.
create policy "floor member decide pending membership" on floor_memberships
  for update
  using (status = 'pending' and is_active_member(floor_id))
  with check (is_active_member(floor_id));

-- tasks / incidents / notifications / redemptions: acotado al piso
create policy "select floor tasks" on tasks for select using (is_active_member(floor_id));
create policy "write floor tasks" on tasks for insert with check (is_active_member(floor_id));
create policy "update floor tasks" on tasks for update using (is_active_member(floor_id));

create policy "select floor incidents" on incidents for select using (is_active_member(floor_id));
create policy "write floor incidents" on incidents for insert with check (is_active_member(floor_id));
create policy "delete floor incidents" on incidents for delete using (is_active_member(floor_id));

create policy "select floor notifications" on notifications for select using (is_active_member(floor_id));
create policy "write floor notifications" on notifications for insert with check (is_active_member(floor_id));
create policy "update floor notifications" on notifications for update using (is_active_member(floor_id));

create policy "select floor redemptions" on redemptions for select using (is_active_member(floor_id));
create policy "write floor redemptions" on redemptions for insert with check (is_active_member(floor_id));

-- coin_transactions: ledger inmutable — solo select/insert, nunca
-- update/delete (ni siquiera el autor puede tocar una fila ya
-- escrita).
create policy "select floor coin transactions" on coin_transactions for select using (is_active_member(floor_id));
create policy "insert floor coin transactions" on coin_transactions for insert with check (is_active_member(floor_id));

-- pot_contributions: ledger inmutable para los APORTES (montos positivos):
-- cada quien registra el suyo, nadie los edita ni borra. Los GASTOS
-- (montos negativos) son la única excepción: quien los registró puede
-- editarlos o borrarlos, pero solo durante las 24h siguientes a haberlos
-- publicado (el "using" deja de matchear la fila pasado ese plazo).
create policy "select floor pot contributions" on pot_contributions for select using (is_active_member(floor_id));
create policy "insert own pot contributions" on pot_contributions for insert with check (is_active_member(floor_id) and user_id = auth.uid());
create policy "author edit own recent expense" on pot_contributions
  for update
  using (user_id = auth.uid() and amount < 0 and kind = 'contribution' and created_at > now() - interval '24 hours')
  with check (user_id = auth.uid() and amount < 0 and kind = 'contribution');
create policy "author delete own recent expense" on pot_contributions
  for delete
  using (user_id = auth.uid() and amount < 0 and kind = 'contribution' and created_at > now() - interval '24 hours');

-- shopping_items: cualquier miembro activo ve, crea, edita y borra (mismo
-- modelo de confianza que el resto de la app).
create policy "select floor shopping items" on shopping_items for select using (is_active_member(floor_id));
create policy "insert floor shopping items" on shopping_items for insert with check (is_active_member(floor_id));
create policy "update floor shopping items" on shopping_items for update using (is_active_member(floor_id));
create policy "delete floor shopping items" on shopping_items for delete using (is_active_member(floor_id));

-- shopping_purchases: ledger inmutable — solo select/insert.
create policy "select floor shopping purchases" on shopping_purchases for select using (is_active_member(floor_id));
create policy "insert floor shopping purchases" on shopping_purchases for insert with check (is_active_member(floor_id));

-- purchase_sessions: mismo modelo que shopping_purchases — ledger, solo select/insert.
alter table purchase_sessions enable row level security;
create policy "select floor purchase sessions" on purchase_sessions for select using (is_active_member(floor_id));
create policy "insert floor purchase sessions" on purchase_sessions for insert with check (is_active_member(floor_id));

-- absence_requests: cualquier miembro ve las solicitudes del piso (para
-- saber quién está fuera); cada quien crea la suya; un admin la decide;
-- el autor puede cancelarla mientras siga pendiente.
alter table absence_requests enable row level security;
create policy "select floor absence requests" on absence_requests for select using (is_active_member(floor_id));
create policy "insert own absence request" on absence_requests for insert with check (is_active_member(floor_id) and user_id = auth.uid());
create policy "admin decide absence request" on absence_requests for update using (is_floor_admin(floor_id));
create policy "author cancel own pending absence" on absence_requests for update using (user_id = auth.uid() and status = 'pending') with check (user_id = auth.uid());

alter table room_partners enable row level security;
create policy "select floor room_partners" on room_partners for select using (is_active_member(floor_id));
create policy "requester create room_partner" on room_partners for insert with check (requester_id = auth.uid() and is_active_member(floor_id));
create policy "partner decide room_partner" on room_partners for update using (partner_id = auth.uid() and status = 'pending') with check (partner_id = auth.uid());
create policy "requester cancel own pending room_partner" on room_partners for update using (requester_id = auth.uid() and status = 'pending') with check (requester_id = auth.uid());
create policy "either side unlink accepted room_partner" on room_partners for update using ((requester_id = auth.uid() or partner_id = auth.uid()) and status = 'accepted') with check (requester_id = auth.uid() or partner_id = auth.uid());

-- polls/poll_votes: mismo modelo de confianza que activities/shopping_items
-- — cualquier miembro activo puede transicionar el estado de una consulta
-- 'pending' (cubre tanto la resolución automática oportunista desde
-- cualquier cliente abierto, igual que el efecto de expiración de
-- absence_requests, como el cierre manual — la UI acota ese botón a
-- autor/admin, no hay distinción a nivel de RLS). Los votos son de cada
-- quien mientras la consulta siga pendiente; sin política de delete en
-- ninguna de las dos, solo transicionan status.
alter table polls enable row level security;
create policy "select floor polls" on polls for select using (is_active_member(floor_id));
create policy "insert own poll" on polls for insert with check (is_active_member(floor_id) and created_by = auth.uid());
create policy "floor member update pending poll" on polls
  for update using (is_active_member(floor_id) and status = 'pending')
  with check (is_active_member(floor_id));

alter table poll_votes enable row level security;
create policy "select floor poll_votes" on poll_votes for select using (is_active_member(floor_id));
create policy "insert own poll_vote" on poll_votes
  for insert with check (
    is_active_member(floor_id) and user_id = auth.uid()
    and exists (select 1 from polls p where p.id = poll_id and p.status = 'pending')
  );
create policy "update own poll_vote while pending" on poll_votes
  for update using (user_id = auth.uid() and exists (select 1 from polls p where p.id = poll_id and p.status = 'pending'))
  with check (user_id = auth.uid());

alter table shared_space_uses enable row level security;
create policy "select floor shared_space_uses" on shared_space_uses for select using (is_active_member(floor_id));
create policy "insert own shared_space_use" on shared_space_uses for insert with check (is_active_member(floor_id) and user_id = auth.uid());
create policy "release own or admin shared_space_use" on shared_space_uses for update using (user_id = auth.uid() or is_floor_admin(floor_id));

alter table wallet_resets enable row level security;
create policy "select floor wallet_resets" on wallet_resets for select using (is_active_member(floor_id));
create policy "insert own wallet_reset" on wallet_resets for insert with check (is_active_member(floor_id) and user_id = auth.uid());

alter table password_reset_attempts enable row level security;

-- activities/activity_completions: mismo modelo colaborativo que
-- shopping_items — cualquier miembro activo del piso puede ver, crear,
-- editar y borrar.
alter table activities enable row level security;
alter table activity_completions enable row level security;
create policy "select floor activities" on activities for select using (is_active_member(floor_id));
create policy "insert floor activities" on activities for insert with check (is_active_member(floor_id));
create policy "update floor activities" on activities for update using (is_active_member(floor_id));
create policy "delete floor activities" on activities for delete using (is_active_member(floor_id));
create policy "select floor activity_completions" on activity_completions for select using (is_active_member(floor_id));
create policy "insert floor activity_completions" on activity_completions for insert with check (is_active_member(floor_id));
create policy "update floor activity_completions" on activity_completions for update using (is_active_member(floor_id));

alter table activity_marks enable row level security;
create policy "select floor activity_marks" on activity_marks for select using (is_active_member(floor_id));
create policy "insert own activity_marks" on activity_marks for insert with check (is_active_member(floor_id) and marked_by = auth.uid());
create policy "delete floor activity_marks" on activity_marks for delete using (is_active_member(floor_id));

-- swap_requests: cualquier miembro ve las del piso; solo quien
-- propone crea; quien recibe decide (aceptar/rechazar) mientras siga
-- pendiente; quien propuso puede cancelar su propia pendiente.
alter table swap_requests enable row level security;
create policy "select floor swap_requests" on swap_requests for select using (is_active_member(floor_id));
create policy "from user create swap_requests" on swap_requests for insert with check (from_user_id = auth.uid() and is_active_member(floor_id));
create policy "to user decide swap_requests" on swap_requests for update using (to_user_id = auth.uid() and status = 'pending') with check (to_user_id = auth.uid());
create policy "from user cancel own pending swap_requests" on swap_requests for update using (from_user_id = auth.uid() and status = 'pending') with check (from_user_id = auth.uid());

-- =========================================================
-- Realtime: para que la app reciba cambios en vivo
-- =========================================================
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table incidents;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table floors;
alter publication supabase_realtime add table profiles;
alter publication supabase_realtime add table redemptions;
alter publication supabase_realtime add table floor_memberships;
alter publication supabase_realtime add table pot_contributions;
alter publication supabase_realtime add table shopping_items;
alter publication supabase_realtime add table shopping_purchases;
alter publication supabase_realtime add table purchase_sessions;
alter publication supabase_realtime add table absence_requests;
alter publication supabase_realtime add table room_partners;
alter publication supabase_realtime add table polls;
alter publication supabase_realtime add table poll_votes;
alter publication supabase_realtime add table wallet_resets;
alter publication supabase_realtime add table shared_space_uses;
alter publication supabase_realtime add table activities;
alter publication supabase_realtime add table activity_completions;
alter publication supabase_realtime add table activity_marks;
alter publication supabase_realtime add table swap_requests;

-- =========================================================
-- Storage: fotos de incidencias y facturas del pote comparten un único
-- bucket público (lectura libre por URL, escritura solo para miembros
-- activos del piso al que pertenece la carpeta).
-- =========================================================
insert into storage.buckets (id, name, public)
values ('incident-photos', 'incident-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "floor members upload photos" on storage.objects;
create policy "floor members upload photos" on storage.objects
  for insert
  with check (
    bucket_id = 'incident-photos'
    and is_active_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "anyone can view photos" on storage.objects;
create policy "anyone can view photos" on storage.objects
  for select
  using (bucket_id = 'incident-photos');

-- Avatares de perfil: bucket propio porque, a diferencia de las fotos de
-- incidencias/pote, un avatar no pertenece a un piso concreto (sigue
-- siendo visible aunque la persona cambie de piso) — las políticas se
-- basan en el propio user_id, no en floor_id.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "users upload own avatar" on storage.objects;
create policy "users upload own avatar" on storage.objects
  for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "anyone can view avatars" on storage.objects;
create policy "anyone can view avatars" on storage.objects
  for select using (bucket_id = 'avatars');


-- =========================================================
-- Perfiles virtuales (una persona del piso que NO usa la app)
--
-- Un perfil virtual es una fila normal de `profiles` marcada is_virtual = true
-- (sin cuenta de acceso) más su fila en floor_memberships. Así todo lo que ya
-- funciona por membresía (rotación, asignaciones, listas, historial, Pote)
-- lo incluye sin reescribirlo. Es idempotente: se puede correr varias veces.
-- (Este mismo contenido está integrado en schema.sql.)
-- =========================================================

-- 1) profiles ya no exige una cuenta de acceso (auth.users). Para conservar el
--    borrado en cascada de cuentas reales (Authentication → Delete user), lo
--    hace ahora un trigger.
alter table profiles drop constraint if exists profiles_id_fkey;
alter table profiles add column if not exists is_virtual boolean not null default false;
alter table profiles add column if not exists created_by uuid references profiles(id) on delete set null;

create or replace function handle_auth_user_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.profiles where id = old.id;
  return old;
end;
$$;
drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute function handle_auth_user_deleted();

-- 2) Aunque un perfil virtual ya no esté activo (lo quitaron del piso), su
--    nombre se sigue viendo en el historial de quienes comparten el piso.
drop policy if exists "select virtual profiles of my floors" on profiles;
create policy "select virtual profiles of my floors" on profiles
  for select using (
    is_virtual
    and exists (
      select 1 from floor_memberships fm
      where fm.user_id = profiles.id
        and is_active_member(fm.floor_id)
    )
  );

-- 3) Pote: cualquier miembro puede registrar un aporte o un gasto EN NOMBRE de
--    un perfil virtual de su piso (queda guardado quién lo registró).
alter table pot_contributions add column if not exists recorded_by uuid references profiles(id) on delete set null;

create or replace function is_virtual_in_floor(p_user_id uuid, p_floor_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from profiles p
    join floor_memberships fm on fm.user_id = p.id
    where p.id = p_user_id
      and p.is_virtual
      and fm.floor_id = p_floor_id
      and fm.status = 'active'
  );
$$;

drop policy if exists "insert own pot contributions" on pot_contributions;
create policy "insert own pot contributions" on pot_contributions
  for insert with check (
    is_active_member(floor_id)
    and (user_id = auth.uid() or (recorded_by = auth.uid() and is_virtual_in_floor(user_id, floor_id)))
  );

drop policy if exists "author edit own recent expense" on pot_contributions;
create policy "author edit own recent expense" on pot_contributions
  for update
  using ((user_id = auth.uid() or recorded_by = auth.uid()) and amount < 0 and kind = 'contribution' and created_at > now() - interval '24 hours')
  with check ((user_id = auth.uid() or recorded_by = auth.uid()) and amount < 0 and kind = 'contribution');

drop policy if exists "author delete own recent expense" on pot_contributions;
create policy "author delete own recent expense" on pot_contributions
  for delete
  using ((user_id = auth.uid() or recorded_by = auth.uid()) and amount < 0 and kind = 'contribution' and created_at > now() - interval '24 hours');

-- 4) Crear / editar un perfil virtual: solo admins del piso. Crea el perfil y
--    su membresía juntos y lo pone al final del orden de rotación.
create or replace function create_virtual_member(p_floor_id uuid, p_name text, p_color text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  if not is_floor_admin(p_floor_id) then
    raise exception 'not_admin';
  end if;
  if p_name is null or length(btrim(p_name)) = 0 or length(btrim(p_name)) > 40 then
    raise exception 'bad_name';
  end if;

  insert into profiles (id, name, color, is_virtual, created_by, onboarding_seen, tutorial_enabled)
    values (v_id, btrim(p_name), p_color, true, auth.uid(), true, false);
  insert into floor_memberships (user_id, floor_id, role, status)
    values (v_id, p_floor_id, 'member', 'active');
  update floors set rotation_order = array_append(rotation_order, v_id) where id = p_floor_id;
  return v_id;
end;
$$;

create or replace function update_virtual_member(p_id uuid, p_name text, p_color text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_floor uuid;
begin
  select fm.floor_id into v_floor
  from floor_memberships fm
  join profiles p on p.id = fm.user_id
  where fm.user_id = p_id and fm.status = 'active' and p.is_virtual
  limit 1;
  if v_floor is null or not is_floor_admin(v_floor) then
    raise exception 'not_allowed';
  end if;
  if p_name is null or length(btrim(p_name)) = 0 or length(btrim(p_name)) > 40 then
    raise exception 'bad_name';
  end if;
  update profiles set name = btrim(p_name), color = p_color where id = p_id;
end;
$$;

-- 5) Vincular un perfil virtual con la cuenta real de la misma persona (cuando
--    por fin se une a la app): todo lo que era del virtual pasa a la cuenta
--    real —turnos, historial, Pote, posición en la rotación— y el perfil
--    virtual desaparece. Solo un admin, y ambos deben ser miembros activos del
--    mismo piso.
create or replace function link_virtual_member(p_virtual_id uuid, p_real_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_floor uuid;
begin
  select fm.floor_id into v_floor
  from floor_memberships fm
  join profiles vp on vp.id = fm.user_id and vp.is_virtual
  where fm.user_id = p_virtual_id
    and fm.status = 'active'
    and exists (
      select 1
      from floor_memberships r
      join profiles rp on rp.id = r.user_id and not rp.is_virtual
      where r.user_id = p_real_id and r.floor_id = fm.floor_id and r.status = 'active'
    )
  limit 1;
  if v_floor is null or not is_floor_admin(v_floor) then
    raise exception 'not_allowed';
  end if;

  update activities set assigned_user_id = p_real_id where floor_id = v_floor and assigned_user_id = p_virtual_id;
  update activity_completions set assigned_user_id = p_real_id where floor_id = v_floor and assigned_user_id = p_virtual_id;
  update activity_marks set marked_by = p_real_id where floor_id = v_floor and marked_by = p_virtual_id;
  update tasks set assigned_user_id = p_real_id where floor_id = v_floor and assigned_user_id = p_virtual_id;
  update pot_contributions set user_id = p_real_id where floor_id = v_floor and user_id = p_virtual_id;
  update pot_contributions
    set split_among = case
      when p_real_id = any(split_among) then array_remove(split_among, p_virtual_id)
      else array_replace(split_among, p_virtual_id, p_real_id)
    end
    where floor_id = v_floor and p_virtual_id = any(split_among);
  update wallet_resets set user_id = p_real_id where floor_id = v_floor and user_id = p_virtual_id;
  update shopping_purchases set user_id = p_real_id where floor_id = v_floor and user_id = p_virtual_id;
  update purchase_sessions set user_id = p_real_id where floor_id = v_floor and user_id = p_virtual_id;
  update absence_requests set user_id = p_real_id where floor_id = v_floor and user_id = p_virtual_id;
  update shared_space_uses set user_id = p_real_id where floor_id = v_floor and user_id = p_virtual_id;

  -- La cuenta real toma el lugar del virtual en la rotación (y se quita su
  -- entrada al final, que se agregó al aprobar su ingreso).
  update floors
    set rotation_order = coalesce((
      select array_agg(x order by ord)
      from (
        select case when e = p_virtual_id then p_real_id else e end as x, ord
        from unnest(rotation_order) with ordinality as t(e, ord)
        where e <> p_real_id
      ) s
    ), '{}')
    where id = v_floor;

  -- Ya no queda nada apuntando al virtual: se elimina su perfil (y su membresía).
  delete from profiles where id = p_virtual_id;
end;
$$;

grant execute on function create_virtual_member(uuid, text, text) to authenticated;
grant execute on function update_virtual_member(uuid, text, text) to authenticated;
grant execute on function link_virtual_member(uuid, uuid) to authenticated;


-- =========================================================
-- Votar una consulta SIN iniciar sesión (link de WhatsApp + PIN personal)
--
-- Cada persona crea un PIN de 6 dígitos estando dentro de la app (Configuración
-- → Seguridad). Con el link de una consulta elige su nombre, pone el PIN y vota;
-- si marca "recordar este móvil", los votos siguientes desde ese móvil no piden
-- el PIN. Solo sirve para consultas normales (kind = 'custom'): las de dinero
-- (Pote) y de rotación siguen exigiendo sesión. Los perfiles virtuales no votan.
-- La consulta se sigue resolviendo desde la app (resolvePoll), igual que hoy.
-- Es idempotente: se puede correr varias veces.
-- (Este mismo contenido está integrado en schema.sql.)
-- =========================================================

create extension if not exists pgcrypto with schema extensions;

-- 1) PIN y móviles recordados. El hash del PIN va en una tabla propia (no en
--    profiles) para que ninguna política de lectura de profiles lo exponga.
--    Sin políticas a propósito: solo se accede desde las funciones de abajo.
create table if not exists poll_pins (
  user_id uuid primary key references profiles(id) on delete cascade,
  pin_hash text not null,
  failed_count int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists poll_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  token_hash text not null unique, -- sha256 del token (el token en claro solo lo tiene el móvil)
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '180 days'
);
create index if not exists poll_devices_user_idx on poll_devices (user_id);

alter table poll_pins enable row level security;
alter table poll_devices enable row level security;

-- 2) Ayudantes internos (no se exponen a ningún cliente)
create or replace function _is_floor_voter(p_user uuid, p_floor uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from floor_memberships fm
    join profiles p on p.id = fm.user_id
    where fm.user_id = p_user
      and fm.floor_id = p_floor
      and fm.status = 'active'
      and not p.is_virtual
  );
$$;

create or replace function _poll_is_open(p polls)
returns boolean
language sql
stable
set search_path = public
as $$
  select p.status = 'pending'
    and (p.deadline is null or p.deadline >= current_date)
    and (p.deadline_at is null or p.deadline_at > now());
$$;

-- Comprueba que se puede votar: consulta normal y abierta, votante del piso y
-- opción válida (p_option_index empieza en 0). No escribe nada.
create or replace function _public_vote_precheck(p_poll_id uuid, p_user_id uuid, p_option_index int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_poll polls%rowtype;
begin
  select * into v_poll from polls where id = p_poll_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'poll_not_found');
  end if;
  if v_poll.kind <> 'custom' then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;
  if not _poll_is_open(v_poll) then
    return jsonb_build_object('ok', false, 'error', 'poll_closed');
  end if;
  if not _is_floor_voter(p_user_id, v_poll.floor_id) then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;
  if p_option_index is null or p_option_index < 0 or p_option_index >= coalesce(array_length(v_poll.options, 1), 0) then
    return jsonb_build_object('ok', false, 'error', 'invalid_option');
  end if;
  return jsonb_build_object('ok', true, 'floor_id', v_poll.floor_id, 'option', v_poll.options[p_option_index + 1]);
end;
$$;

-- Guarda (o cambia) el voto de esa persona. Asume que _public_vote_precheck ya dio ok.
create or replace function _public_vote_write(p_poll_id uuid, p_user_id uuid, p_check jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into poll_votes (poll_id, floor_id, user_id, option)
  values (p_poll_id, (p_check->>'floor_id')::uuid, p_user_id, p_check->>'option')
  on conflict (poll_id, user_id) do update set option = excluded.option;
$$;

-- 3) PIN: lo gestiona la persona logueada en la app
create or replace function has_poll_pin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from poll_pins where user_id = auth.uid());
$$;

create or replace function set_poll_pin(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{6}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_format');
  end if;

  insert into poll_pins (user_id, pin_hash)
  values (auth.uid(), crypt(p_pin, gen_salt('bf', 8)))
  on conflict (user_id) do update
    set pin_hash = excluded.pin_hash,
        failed_count = 0,
        locked_until = null,
        updated_at = now();

  -- Cambiar el PIN desconecta todos los móviles recordados.
  delete from poll_devices where user_id = auth.uid();
  return jsonb_build_object('ok', true);
end;
$$;

-- Un admin del piso borra el PIN de un miembro (p. ej. "lo olvidé"): esa
-- persona crea uno nuevo desde la app.
create or replace function reset_member_pin(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from floor_memberships a
    join floor_memberships t on t.floor_id = a.floor_id
    where a.user_id = auth.uid() and a.role = 'admin' and a.status = 'active'
      and t.user_id = p_user_id and t.status = 'active'
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;

  delete from poll_pins where user_id = p_user_id;
  delete from poll_devices where user_id = p_user_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- 4) Endpoints públicos (el link de WhatsApp, sin sesión)

-- Carga la consulta, quiénes pueden votar (sin perfiles virtuales) y, si este
-- móvil está recordado, quién es y qué votó. El recuento solo se entrega a quien
-- ya se identificó o cuando la consulta terminó.
create or replace function get_public_poll(p_poll_id uuid, p_device_token text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_poll polls%rowtype;
  v_me uuid;
  v_open boolean;
begin
  select * into v_poll from polls where id = p_poll_id and kind = 'custom';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'poll_not_found');
  end if;
  v_open := _poll_is_open(v_poll);

  if p_device_token is not null then
    select d.user_id into v_me
    from poll_devices d
    where d.token_hash = encode(digest(p_device_token, 'sha256'), 'hex')
      and d.expires_at > now();
    if v_me is not null and not _is_floor_voter(v_me, v_poll.floor_id) then
      v_me := null;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'poll', jsonb_build_object(
      'id', v_poll.id,
      'floor_name', (select name from floors where id = v_poll.floor_id),
      'question', v_poll.question,
      'options', to_jsonb(v_poll.options),
      'resolution_mode', v_poll.resolution_mode,
      'deadline', v_poll.deadline,
      'deadline_at', v_poll.deadline_at,
      'status', v_poll.status,
      'resolved_option', v_poll.resolved_option,
      'is_open', v_open
    ),
    'members', case when v_open and v_me is null then coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'has_pin', pp.user_id is not null) order by p.name)
      from floor_memberships m
      join profiles p on p.id = m.user_id and not p.is_virtual
      left join poll_pins pp on pp.user_id = p.id
      where m.floor_id = v_poll.floor_id and m.status = 'active'
    ), '[]'::jsonb) else '[]'::jsonb end,
    'me', case when v_me is null then null else jsonb_build_object(
      'id', v_me,
      'name', (select name from profiles where id = v_me),
      'vote', (select option from poll_votes where poll_id = p_poll_id and user_id = v_me)
    ) end,
    'tally', case when v_me is not null or not v_open then coalesce((
      select jsonb_object_agg(t.option, t.n)
      from (select option, count(*) as n from poll_votes where poll_id = p_poll_id group by option) t
    ), '{}'::jsonb) else null end,
    'voted_count', (
      select count(*) from poll_votes v
      where v.poll_id = p_poll_id and _is_floor_voter(v.user_id, v_poll.floor_id)
    ),
    'total_voters', (
      select count(*) from floor_memberships m
      join profiles p on p.id = m.user_id and not p.is_virtual
      where m.floor_id = v_poll.floor_id and m.status = 'active'
    )
  );
end;
$$;

-- Primer voto desde un móvil: nombre + PIN. Devuelve device_token si p_remember.
-- 5 PIN incorrectos seguidos bloquean a esa persona 15 minutos.
create or replace function vote_with_pin(
  p_poll_id uuid,
  p_user_id uuid,
  p_pin text,
  p_option_index int,
  p_remember boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_check jsonb;
  v_pin poll_pins%rowtype;
  v_token text;
  v_result jsonb := jsonb_build_object('ok', true);
begin
  -- Antes de mirar el PIN: que la consulta esté abierta y la persona sea del
  -- piso, para no gastar intentos (ni revelar nada) con datos que no encajan.
  v_check := _public_vote_precheck(p_poll_id, p_user_id, p_option_index);
  if not (v_check->>'ok')::boolean then
    return v_check;
  end if;

  select * into v_pin from poll_pins where user_id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_pin');
  end if;
  if v_pin.locked_until is not null and v_pin.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'locked', 'locked_until', v_pin.locked_until);
  end if;

  if crypt(coalesce(p_pin, ''), v_pin.pin_hash) <> v_pin.pin_hash then
    update poll_pins set
      failed_count = case when failed_count + 1 >= 5 then 0 else failed_count + 1 end,
      locked_until = case when failed_count + 1 >= 5 then now() + interval '15 minutes' else null end
    where user_id = p_user_id;
    return jsonb_build_object('ok', false, 'error', 'wrong_pin');
  end if;

  update poll_pins set failed_count = 0, locked_until = null where user_id = p_user_id;
  perform _public_vote_write(p_poll_id, p_user_id, v_check);

  if p_remember then
    v_token := encode(gen_random_bytes(32), 'hex');
    insert into poll_devices (user_id, token_hash) values (p_user_id, encode(digest(v_token, 'sha256'), 'hex'));
    v_result := v_result || jsonb_build_object('device_token', v_token);
  end if;
  return v_result;
end;
$$;

-- Votos siguientes desde un móvil ya recordado: sin PIN.
create or replace function vote_with_device(p_poll_id uuid, p_device_token text, p_option_index int)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_device poll_devices%rowtype;
  v_check jsonb;
begin
  select * into v_device
  from poll_devices
  where token_hash = encode(digest(coalesce(p_device_token, ''), 'sha256'), 'hex')
    and expires_at > now();
  if not found then
    return jsonb_build_object('ok', false, 'error', 'device_not_recognized');
  end if;

  v_check := _public_vote_precheck(p_poll_id, v_device.user_id, p_option_index);
  if not (v_check->>'ok')::boolean then
    return v_check;
  end if;

  perform _public_vote_write(p_poll_id, v_device.user_id, v_check);
  update poll_devices set last_used_at = now(), expires_at = now() + interval '180 days' where id = v_device.id;
  return jsonb_build_object('ok', true);
end;
$$;

-- "No soy yo" / olvidar este móvil.
create or replace function forget_device(p_device_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from poll_devices where token_hash = encode(digest(coalesce(p_device_token, ''), 'sha256'), 'hex');
  return jsonb_build_object('ok', true);
end;
$$;

-- 5) Permisos: Supabase concede EXECUTE a anon/authenticated por defecto, así que
--    se revoca todo y se concede solo lo necesario.
revoke all on function _is_floor_voter(uuid, uuid) from public, anon, authenticated;
revoke all on function _poll_is_open(polls) from public, anon, authenticated;
revoke all on function _public_vote_precheck(uuid, uuid, int) from public, anon, authenticated;
revoke all on function _public_vote_write(uuid, uuid, jsonb) from public, anon, authenticated;

revoke all on function has_poll_pin() from public, anon;
revoke all on function set_poll_pin(text) from public, anon;
revoke all on function reset_member_pin(uuid) from public, anon;
grant execute on function has_poll_pin() to authenticated;
grant execute on function set_poll_pin(text) to authenticated;
grant execute on function reset_member_pin(uuid) to authenticated;

revoke all on function get_public_poll(uuid, text) from public;
revoke all on function vote_with_pin(uuid, uuid, text, int, boolean) from public;
revoke all on function vote_with_device(uuid, text, int) from public;
revoke all on function forget_device(text) from public;
grant execute on function get_public_poll(uuid, text) to anon, authenticated;
grant execute on function vote_with_pin(uuid, uuid, text, int, boolean) to anon, authenticated;
grant execute on function vote_with_device(uuid, text, int) to anon, authenticated;
grant execute on function forget_device(text) to anon, authenticated;
