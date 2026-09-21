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

alter table poll_pins add column if not exists pw_failed_count int not null default 0;
alter table poll_pins add column if not exists pw_locked_until timestamptz;

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

  -- Solo CREA el PIN (la primera vez). Cambiarlo exige la contraseña de Convive:
  -- ver change_poll_pin.
  insert into poll_pins (user_id, pin_hash)
  values (auth.uid(), crypt(p_pin, gen_salt('bf', 8)))
  on conflict (user_id) do nothing;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'pin_exists');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Cambiar un PIN que ya existe: pide la contraseña de acceso a Convive y la
-- comprueba aquí mismo, en el servidor (5 fallos seguidos bloquean 15 minutos).
-- Cambiarlo desconecta todos los móviles recordados.
create or replace function change_poll_pin(p_password text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_pin poll_pins%rowtype;
  v_hash text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{6}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_format');
  end if;

  select * into v_pin from poll_pins where user_id = auth.uid() for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_pin');
  end if;
  if v_pin.pw_locked_until is not null and v_pin.pw_locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'locked', 'locked_until', v_pin.pw_locked_until);
  end if;

  select encrypted_password into v_hash from auth.users where id = auth.uid();
  if v_hash is null or coalesce(p_password, '') = '' or crypt(p_password, v_hash) <> v_hash then
    update poll_pins set
      pw_failed_count = case when pw_failed_count + 1 >= 5 then 0 else pw_failed_count + 1 end,
      pw_locked_until = case when pw_failed_count + 1 >= 5 then now() + interval '15 minutes' else null end
    where user_id = auth.uid();
    return jsonb_build_object('ok', false, 'error', 'wrong_password');
  end if;

  update poll_pins set
    pin_hash = crypt(p_pin, gen_salt('bf', 8)),
    failed_count = 0,
    locked_until = null,
    pw_failed_count = 0,
    pw_locked_until = null,
    updated_at = now()
  where user_id = auth.uid();
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
revoke all on function change_poll_pin(text, text) from public, anon;
grant execute on function change_poll_pin(text, text) to authenticated;

revoke all on function get_public_poll(uuid, text) from public;
revoke all on function vote_with_pin(uuid, uuid, text, int, boolean) from public;
revoke all on function vote_with_device(uuid, text, int) from public;
revoke all on function forget_device(text) from public;
grant execute on function get_public_poll(uuid, text) to anon, authenticated;
grant execute on function vote_with_pin(uuid, uuid, text, int, boolean) to anon, authenticated;
grant execute on function vote_with_device(uuid, text, int) to anon, authenticated;
grant execute on function forget_device(text) to anon, authenticated;
