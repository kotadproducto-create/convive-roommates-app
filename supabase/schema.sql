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
  avatar_url text,
  age_public boolean not null default true, -- privacidad de presentación (no RLS): oculta la edad a otros en Convives
  phone_public boolean not null default true, -- ídem para el teléfono
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
  pot_amount numeric not null default 0,
  pot_threshold numeric not null default 30,
  pot_per_person numeric not null default 10,
  whatsapp_group_url text,
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
  pot_active boolean not null default true, -- baja temporal del reparto del pote (viaje, etc.); no afecta la membresía real del piso. Se muestra como "de vacaciones" en la tarjeta de Convives (invertido: vacaciones = pot_active false)
  active_status boolean not null default true, -- indicador informativo de presencia en el piso ("Convives"); no afecta rotación de tareas ni el pote, solo visual
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
  created_at timestamptz not null default now()
);

create index if not exists shopping_purchases_floor_idx on shopping_purchases (floor_id);

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
  using (user_id = auth.uid() and amount < 0 and created_at > now() - interval '24 hours')
  with check (user_id = auth.uid() and amount < 0);
create policy "author delete own recent expense" on pot_contributions
  for delete
  using (user_id = auth.uid() and amount < 0 and created_at > now() - interval '24 hours');

-- shopping_items: cualquier miembro activo ve, crea, edita y borra (mismo
-- modelo de confianza que el resto de la app).
create policy "select floor shopping items" on shopping_items for select using (is_active_member(floor_id));
create policy "insert floor shopping items" on shopping_items for insert with check (is_active_member(floor_id));
create policy "update floor shopping items" on shopping_items for update using (is_active_member(floor_id));
create policy "delete floor shopping items" on shopping_items for delete using (is_active_member(floor_id));

-- shopping_purchases: ledger inmutable — solo select/insert.
create policy "select floor shopping purchases" on shopping_purchases for select using (is_active_member(floor_id));
create policy "insert floor shopping purchases" on shopping_purchases for insert with check (is_active_member(floor_id));

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
alter publication supabase_realtime add table absence_requests;
alter publication supabase_realtime add table room_partners;

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
