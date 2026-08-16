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
  points integer not null default 0,
  reputation_score numeric not null default 0, -- automática, no transferible, calculada desde el historial de tareas en todos los pisos (sin lógica todavía, Fase 1+)
  presentation_message text check (char_length(presentation_message) <= 240), -- único de perfil, se reutiliza al unirse a cualquier piso (sin UI todavía, Fase 1+)
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
  created_at timestamptz not null default now()
);

-- Membresías: historial de pertenencia de un usuario a pisos.
-- Como mucho una fila 'active' por usuario (constraint de BD más
-- abajo). Reactivar una membresía 'left' pasa por dejarla en
-- 'pending' hasta que un admin del piso la apruebe a 'active'
-- (la UI de ese flujo es de una fase posterior; aquí solo se deja
-- preparado el estado).
create table if not exists floor_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  floor_id uuid not null references floors(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  status text not null default 'active' check (status in ('active', 'left', 'pending')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  pot_active boolean not null default true -- baja temporal del reparto del pote (viaje, etc.); no afecta la membresía real del piso
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

-- Ledger inmutable de aportes reales (EUR) al pote de compras compartido.
-- floors.pot_amount sigue siendo el total rápido de mostrar; esta tabla es
-- el historial que permite calcular cuánto aportó cada quién.
create table if not exists pot_contributions (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references floors(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  amount numeric not null,
  created_at timestamptz not null default now()
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
create policy "select own or shared-floor profiles" on profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from floor_memberships fm
      where fm.user_id = profiles.id
        and fm.status = 'active'
        and is_active_member(fm.floor_id)
    )
  );
create policy "insert own profile" on profiles
  for insert with check (id = auth.uid());
create policy "update own profile" on profiles
  for update using (id = auth.uid());

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

-- pot_contributions: ledger inmutable — cada quien registra su propio
-- aporte, nadie edita ni borra una fila ya escrita.
create policy "select floor pot contributions" on pot_contributions for select using (is_active_member(floor_id));
create policy "insert own pot contributions" on pot_contributions for insert with check (is_active_member(floor_id) and user_id = auth.uid());

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
