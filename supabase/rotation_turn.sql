-- =========================================================
-- Asignar manualmente quién tiene el turno actual (sin reordenar a nadie)
--
-- "Orden de rotación" ya deja reordenar a las personas (rotation_direct.sql) y
-- configurar el modo/período (proposeRotationChange, con votación). Esto es
-- una capa aparte: un admin puede corregir A QUIÉN LE TOCA AHORA sin tocar el
-- orden configurado — los turnos siguientes vuelven a seguir ese mismo orden,
-- solo desplazados en fase. Se guarda como un desfase (rotation_offset) que
-- rotationPick (lib/activities.js) suma al índice de período de siempre, así
-- que aplica por igual a TODA actividad por rotación, al "encargado del
-- piso" (floorKeeperFor) y al link público de turnos — nunca queda una
-- pantalla mostrando a alguien distinto de otra para el mismo turno.
-- Es idempotente: se puede correr varias veces.
-- (Este mismo contenido está integrado en schema.sql.)
-- =========================================================

alter table floors add column if not exists rotation_offset integer not null default 0;

-- Reordenar a las personas invalida cualquier desfase anterior (ya no
-- significaría lo mismo sobre el orden nuevo): se reinicia a 0 igual que
-- rotation_epoch.
create or replace function set_rotation_order_direct(p_floor_id uuid, p_new_order uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_ids uuid[];
  v_new_sorted uuid[];
begin
  if not is_floor_admin(p_floor_id) then
    raise exception 'not_admin';
  end if;

  select array_agg(user_id order by user_id) into v_current_ids
  from floor_memberships
  where floor_id = p_floor_id and status = 'active';

  select array_agg(x order by x) into v_new_sorted from unnest(p_new_order) as x;

  if v_current_ids is null or v_new_sorted is distinct from v_current_ids then
    raise exception 'invalid_order';
  end if;

  update floors
    set rotation_order = p_new_order, rotation_epoch = current_date, rotation_offset = 0
    where id = p_floor_id;

  insert into notifications (floor_id, user_id, type, message)
  values (
    p_floor_id,
    null,
    'rotation_order_updated',
    coalesce((select name from profiles where id = auth.uid()), 'Un admin') || ' actualizó el orden de rotación del piso.'
  );
end;
$$;

-- Fija el desfase de fase directamente (el cliente ya calculó, con las
-- mismas funciones puras que usa toda la app — floorKeeperIndex/rotationPick
-- en lib/activities.js —, cuánto hace falta para que le toque a la persona
-- elegida ahora mismo). Solo admins; no dispara ninguna consulta ni
-- notificación — es una corrección puntual, no un cambio de gobierno del piso.
create or replace function set_rotation_turn_direct(p_floor_id uuid, p_offset int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_floor_admin(p_floor_id) then
    raise exception 'not_admin';
  end if;
  update floors set rotation_offset = coalesce(p_offset, 0) where id = p_floor_id;
end;
$$;

revoke all on function set_rotation_turn_direct(uuid, int) from public, anon;
grant execute on function set_rotation_turn_direct(uuid, int) to authenticated;
