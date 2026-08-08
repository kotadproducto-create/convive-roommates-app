-- =========================================================
-- Convive — Esquema de base de datos para Supabase
-- =========================================================
-- Cómo usar: Supabase Dashboard → tu proyecto → "SQL Editor"
-- → "New query" → pega todo este archivo → "Run".
-- Se puede ejecutar una sola vez de golpe.
-- =========================================================

-- Tabla de perfiles: extiende auth.users (que gestiona Supabase)
-- con los datos propios de la app (nombre, piso, rol, puntos).
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  floor_id uuid,
  role text not null default 'member', -- 'admin' | 'member'
  points integer not null default 0,
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

alter table profiles
  add constraint profiles_floor_fk foreign key (floor_id) references floors(id) on delete set null;

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

-- =========================================================
-- Función auxiliar: piso del usuario que hace la petición
-- =========================================================
create or replace function my_floor_id()
returns uuid
language sql
security definer
stable
as $$
  select floor_id from profiles where id = auth.uid();
$$;

-- =========================================================
-- Seguridad a nivel de fila (RLS)
-- Simplificación deliberada para un piso pequeño de confianza:
-- cualquier miembro autenticado de un piso puede leer/escribir
-- los datos de SU piso. Los roles (admin/miembro) se controlan
-- en la interfaz, no aquí. Si quisieras impedir por ejemplo que
-- un "member" reordene la rotación incluso saltándose la UI,
-- habría que añadir una condición extra comprobando el rol.
-- =========================================================

alter table profiles enable row level security;
alter table floors enable row level security;
alter table tasks enable row level security;
alter table incidents enable row level security;
alter table notifications enable row level security;
alter table redemptions enable row level security;

-- profiles: ves tu propio perfil y el de tus compañeros de piso;
-- solo puedes crear/editar el tuyo.
create policy "select own or floor profiles" on profiles
  for select using (id = auth.uid() or floor_id = my_floor_id());
create policy "insert own profile" on profiles
  for insert with check (id = auth.uid());
create policy "update floor profiles" on profiles
  for update using (id = auth.uid() or floor_id = my_floor_id());
create policy "delete floor profiles" on profiles
  for delete using (floor_id = my_floor_id());

-- floors: cualquiera autenticado puede crear un piso nuevo
-- (todavía no tiene floor_id asignado en ese momento);
-- solo ves/editas el tuyo una vez estás dentro.
create policy "insert any floor" on floors
  for insert with check (auth.uid() is not null);
create policy "select own floor" on floors
  for select using (id = my_floor_id() or true); -- true: necesario para buscar por invite_code al unirse
create policy "update own floor" on floors
  for update using (id = my_floor_id());

-- tasks / incidents / notifications / redemptions: acotado al piso
create policy "select floor tasks" on tasks for select using (floor_id = my_floor_id());
create policy "write floor tasks" on tasks for insert with check (floor_id = my_floor_id());
create policy "update floor tasks" on tasks for update using (floor_id = my_floor_id());

create policy "select floor incidents" on incidents for select using (floor_id = my_floor_id());
create policy "write floor incidents" on incidents for insert with check (floor_id = my_floor_id());
create policy "delete floor incidents" on incidents for delete using (floor_id = my_floor_id());

create policy "select floor notifications" on notifications for select using (floor_id = my_floor_id());
create policy "write floor notifications" on notifications for insert with check (floor_id = my_floor_id());
create policy "update floor notifications" on notifications for update using (floor_id = my_floor_id());

create policy "select floor redemptions" on redemptions for select using (floor_id = my_floor_id());
create policy "write floor redemptions" on redemptions for insert with check (floor_id = my_floor_id());

-- =========================================================
-- Realtime: para que la app reciba cambios en vivo
-- =========================================================
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table incidents;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table floors;
alter publication supabase_realtime add table profiles;
alter publication supabase_realtime add table redemptions;
