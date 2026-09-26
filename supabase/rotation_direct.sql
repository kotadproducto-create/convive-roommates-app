-- =========================================================
-- Cambio directo del orden de rotación (solo el ORDEN de personas)
--
-- Hasta ahora, cualquier cambio de rotación (orden, modo o frecuencia) tenía
-- que pasar por una consulta que el piso aprobara (ver proposeRotationChange /
-- kind 'rotation_order' en polls). A partir de ahora un admin puede reordenar
-- directamente a las personas — se aplica al instante, sin votación — y el
-- piso recibe una notificación con una previsualización clara del nuevo orden
-- y sus turnos, con "Estoy de acuerdo" como acción principal. Cualquiera puede,
-- en cambio, sugerir un orden distinto: esa alternativa sí se somete a la
-- votación de siempre (sin cambios en esa parte).
--
-- El modo (Aleatorio/Determinado) y la frecuencia del modo Determinado NO
-- entran acá — esos siguen yendo siempre a votación (proposeRotationChange).
--
-- "update own floor" (RLS de floors) ya permite a CUALQUIER miembro activo
-- actualizar rotation_order — lo necesita el dispositivo que resuelve una
-- consulta aprobada, sea o no el de un admin — así que la única forma segura
-- de exigir que ESTE cambio directo lo haga solo un admin es una función
-- security definer que lo compruebe ella misma, en vez de una política RLS
-- (que bloquearía también la resolución de consultas desde el dispositivo de
-- alguien que no es admin). Es idempotente: se puede correr varias veces.
-- (Este mismo contenido está integrado en schema.sql.)
-- =========================================================

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

  -- El nuevo orden debe ser exactamente una reordenación de quienes ya están
  -- activos en el piso — ni de más, ni de menos, ni de otro piso.
  if v_current_ids is null or v_new_sorted is distinct from v_current_ids then
    raise exception 'invalid_order';
  end if;

  update floors
    set rotation_order = p_new_order, rotation_epoch = current_date
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

revoke all on function set_rotation_order_direct(uuid, uuid[]) from public, anon;
grant execute on function set_rotation_order_direct(uuid, uuid[]) to authenticated;
