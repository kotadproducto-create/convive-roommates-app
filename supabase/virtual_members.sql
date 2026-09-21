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
