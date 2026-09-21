-- =========================================================
-- Link público de turnos (solo lectura, sin iniciar sesión)
--
-- Un link corto (y su QR) que cualquiera puede abrir para ver a quién le toca y
-- quién está a cargo del piso ahora. No permite cambiar nada. El acceso lo da un
-- token largo y no adivinable, que un admin puede activar, desactivar o
-- regenerar (al regenerarlo, el link anterior deja de funcionar). Cualquier
-- miembro del piso puede ver y compartir el link cuando está activo.
-- Solo se entrega lo mínimo: nombres, actividades recurrentes, quién tiene cada
-- turno y quién está fuera. Nada de Pote, puntos, teléfonos ni fotos.
-- Es idempotente: se puede correr varias veces.
-- (Este mismo contenido está integrado en schema.sql.)
-- =========================================================

create extension if not exists pgcrypto with schema extensions;

-- 1) Un link por piso. Sin políticas a propósito: solo se accede con las
--    funciones de abajo.
create table if not exists floor_public_links (
  floor_id uuid primary key references floors(id) on delete cascade,
  token text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table floor_public_links enable row level security;

-- 2) Ver el link del propio piso (cualquier miembro activo). El token solo se
--    entrega mientras el link está activo.
create or replace function get_floor_public_link(p_floor_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_link floor_public_links%rowtype;
begin
  if not is_active_member(p_floor_id) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;
  select * into v_link from floor_public_links where floor_id = p_floor_id;
  if not found then
    return jsonb_build_object('ok', true, 'exists', false, 'enabled', false);
  end if;
  return jsonb_build_object(
    'ok', true,
    'exists', true,
    'enabled', v_link.enabled,
    'token', case when v_link.enabled then v_link.token else null end
  );
end;
$$;

-- 3) Activar, desactivar o regenerar (solo admins).
--    p_action: 'enable' | 'disable' | 'regenerate'
create or replace function set_floor_public_link(p_floor_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not is_floor_admin(p_floor_id) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;

  if p_action = 'enable' then
    insert into floor_public_links (floor_id, token)
    values (p_floor_id, encode(gen_random_bytes(24), 'hex'))
    on conflict (floor_id) do update set enabled = true, updated_at = now();
  elsif p_action = 'disable' then
    update floor_public_links set enabled = false, updated_at = now() where floor_id = p_floor_id;
  elsif p_action = 'regenerate' then
    insert into floor_public_links (floor_id, token)
    values (p_floor_id, encode(gen_random_bytes(24), 'hex'))
    on conflict (floor_id) do update
      set token = encode(gen_random_bytes(24), 'hex'), enabled = true, updated_at = now();
  else
    return jsonb_build_object('ok', false, 'error', 'bad_action');
  end if;

  return get_floor_public_link(p_floor_id);
end;
$$;

-- 4) Lo que ve quien abre el link (anon). Devuelve los datos crudos que la app ya
--    sabe interpretar (rotación, actividades recurrentes y sus turnos del período
--    actual); el cálculo de "ahora" y "siguiente" se hace en el navegador con la
--    misma lógica que usa la app.
create or replace function get_public_turns(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_floor uuid;
  f floors%rowtype;
begin
  select l.floor_id into v_floor
  from floor_public_links l
  where l.token = p_token and l.enabled;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select * into f from floors where id = v_floor;

  return jsonb_build_object(
    'ok', true,
    'floor', jsonb_build_object(
      'name', f.name,
      'rotationOrder', to_jsonb(f.rotation_order),
      'rotationMode', f.rotation_mode,
      'rotationPeriodUnit', f.rotation_period_unit,
      'rotationPeriodInterval', f.rotation_period_interval,
      'rotationEpoch', f.rotation_epoch
    ),
    'members', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', p.id, 'name', p.name, 'isVirtual', p.is_virtual, 'away', m.pot_active is false)
        order by p.name
      )
      from floor_memberships m
      join profiles p on p.id = m.user_id
      where m.floor_id = v_floor and m.status = 'active'
    ), '[]'::jsonb),
    'activities', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'title', a.title,
          'fixedKey', a.fixed_key,
          'frequencyType', a.frequency_type,
          'recurrenceUnit', a.recurrence_unit,
          'recurrenceInterval', a.recurrence_interval,
          'weekdays', to_jsonb(a.weekdays),
          'startDate', a.start_date,
          'untilDate', a.until_date,
          'timesPerWeek', a.times_per_week,
          'assignmentMode', a.assignment_mode,
          'assignedUserId', a.assigned_user_id
        )
        order by a.created_at
      )
      from activities a
      where a.floor_id = v_floor and a.frequency_type = 'recurring'
    ), '[]'::jsonb),
    'completions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'activityId', c.activity_id,
          'periodKey', c.period_key,
          'assignedUserId', c.assigned_user_id,
          'timesDone', c.times_done,
          'completed', c.completed
        )
      )
      from activity_completions c
      where c.floor_id = v_floor and c.created_at > now() - interval '45 days'
    ), '[]'::jsonb)
  );
end;
$$;

-- 5) Permisos: solo lo necesario.
revoke all on function get_floor_public_link(uuid) from public, anon;
revoke all on function set_floor_public_link(uuid, text) from public, anon;
grant execute on function get_floor_public_link(uuid) to authenticated;
grant execute on function set_floor_public_link(uuid, text) to authenticated;

revoke all on function get_public_turns(text) from public;
grant execute on function get_public_turns(text) to anon, authenticated;
