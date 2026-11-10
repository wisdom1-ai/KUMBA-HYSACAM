CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  select exists (select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and approval_status = 'approved');
$function$;

CREATE OR REPLACE FUNCTION public.is_approved_worker()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  select exists (select 1 from public.profiles
    where id = auth.uid() and role = 'worker' and approval_status = 'approved');
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare
  requested text := lower(coalesce(new.raw_user_meta_data->>'requested_role', 'resident'));
  final_role public.user_role;
  final_status public.approval_status;
begin
  if requested = 'worker' then
    final_role := 'worker'; final_status := 'pending';
  else
    final_role := 'resident'; final_status := 'approved';
  end if;
  insert into public.profiles (id, full_name, email, phone, role, approval_status)
  values (new.id,
          left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120),
          new.email,
          left(new.raw_user_meta_data->>'phone', 30),
          final_role, final_status);
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.protect_profile_columns()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.id is distinct from old.id
       or new.role is distinct from old.role
       or new.approval_status is distinct from old.approval_status
       or new.email is distinct from old.email then
      raise exception 'Not allowed to change role, approval status, email or id';
    end if;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.history_before_insert()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $function$
begin
  new.valid_until := new.cleaned_at + interval '24 hours';
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.history_protect()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'Cleaning history records cannot be deleted';
  end if;
  if new.id is distinct from old.id or new.cleaned_at is distinct from old.cleaned_at
     or new.recorded_status is distinct from old.recorded_status or new.notes is distinct from old.notes
     or new.valid_until is distinct from old.valid_until or new.idempotency_key is distinct from old.idempotency_key
     or new.dustbin_name is distinct from old.dustbin_name or new.dustbin_area is distinct from old.dustbin_area
     or new.created_at is distinct from old.created_at
     or (new.dustbin_id is distinct from old.dustbin_id and new.dustbin_id is not null)
     or (new.worker_id is distinct from old.worker_id and new.worker_id is not null)
     or (new.task_id is distinct from old.task_id and new.task_id is not null) then
    raise exception 'Cleaning history records are permanent and cannot be edited';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.reports_before_write()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
begin
  if new.assigned_worker_id is not null
     and (tg_op = 'INSERT' or new.assigned_worker_id is distinct from old.assigned_worker_id) then
    if not exists (select 1 from public.profiles
                   where id = new.assigned_worker_id and role = 'worker' and approval_status = 'approved') then
      raise exception 'Assigned user must be an approved worker';
    end if;
    if new.status in ('submitted','under_review') then new.status := 'assigned'; end if;
  end if;
  if new.status in ('resolved','rejected') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.resolved_at := now();
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.reports_log_status()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
begin
  if tg_op = 'INSERT' then
    insert into public.report_history (report_id, old_status, new_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.report_history (report_id, old_status, new_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.tasks_before_write()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare d record;
begin
  if tg_op = 'INSERT' then
    if new.dustbin_id is null then raise exception 'dustbin_id is required'; end if;
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  if new.dustbin_id is not null and (tg_op = 'INSERT' or new.dustbin_id is distinct from old.dustbin_id) then
    select name, area into d from public.dustbins where id = new.dustbin_id;
    if not found then raise exception 'Dustbin not found'; end if;
    new.dustbin_name := d.name; new.dustbin_area := d.area;
  end if;
  if new.assigned_worker_id is not null
     and (tg_op = 'INSERT' or new.assigned_worker_id is distinct from old.assigned_worker_id) then
    if not exists (select 1 from public.profiles
                   where id = new.assigned_worker_id and role = 'worker' and approval_status = 'approved') then
      raise exception 'Assigned user must be an approved worker';
    end if;
    new.assigned_at := now();
    if new.status = 'pending' then new.status := 'assigned'; end if;
  end if;
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed')
     and coalesce(current_setting('app.task_fn', true), '') <> 'on' then
    raise exception 'Tasks can only be completed through complete_task()';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public._record_cleaning_internal(p_dustbin_id bigint, p_worker uuid, p_notes text, p_key text, p_task_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare d record; hid uuid;
begin
  if p_key is not null then
    select id into hid from public.cleaning_history where idempotency_key = p_key;
    if found then return hid; end if;
  end if;
  if p_task_id is not null then
    select id into hid from public.cleaning_history where task_id = p_task_id;
    if found then return hid; end if;
  end if;
  select name, area into d from public.dustbins where id = p_dustbin_id for update;
  if not found then raise exception 'Dustbin not found'; end if;
  insert into public.cleaning_history (dustbin_id, dustbin_name, dustbin_area, worker_id, task_id, notes, idempotency_key)
  values (p_dustbin_id, d.name, d.area, p_worker, p_task_id, left(p_notes, 1000), p_key)
  on conflict do nothing
  returning id into hid;
  if hid is null then
    select id into hid from public.cleaning_history
     where (p_key is not null and idempotency_key = p_key) or (p_task_id is not null and task_id = p_task_id) limit 1;
    return hid;
  end if;
  update public.dustbins set status = 'collected', last_cleaned_at = now() where id = p_dustbin_id;
  return hid;
end $function$;

CREATE OR REPLACE FUNCTION public.record_cleaning(p_dustbin_id bigint, p_notes text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not (public.is_admin() or public.is_approved_worker()) then
    raise exception 'Only approved workers or admins can record cleanings';
  end if;
  return public._record_cleaning_internal(p_dustbin_id, auth.uid(), p_notes, p_idempotency_key, null);
end $function$;

CREATE OR REPLACE FUNCTION public.start_task(p_task_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare t record;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into t from public.collection_tasks where id = p_task_id for update;
  if not found then raise exception 'Task not found'; end if;
  if not (public.is_admin() or (public.is_approved_worker() and t.assigned_worker_id = auth.uid())) then
    raise exception 'Not allowed';
  end if;
  if t.status = 'in_progress' then return; end if;
  if t.status <> 'assigned' then raise exception 'Task is % and cannot be started', t.status; end if;
  update public.collection_tasks set status = 'in_progress', started_at = now() where id = t.id;
end $function$;

CREATE OR REPLACE FUNCTION public.complete_task(p_task_id uuid, p_notes text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare t record; hid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into t from public.collection_tasks where id = p_task_id for update;
  if not found then raise exception 'Task not found'; end if;
  if not (public.is_admin() or (public.is_approved_worker() and t.assigned_worker_id = auth.uid())) then
    raise exception 'Not allowed';
  end if;
  if t.status = 'completed' then
    select id into hid from public.cleaning_history where task_id = t.id;
    return hid;
  end if;
  if t.status not in ('assigned','in_progress') then
    raise exception 'Task is % and cannot be completed', t.status;
  end if;
  if t.dustbin_id is null then raise exception 'Task has no dustbin'; end if;
  perform set_config('app.task_fn', 'on', true);
  update public.collection_tasks
     set status = 'completed', completed_at = now(), started_at = coalesce(started_at, now()),
         completion_notes = left(p_notes, 1000)
   where id = t.id;
  perform set_config('app.task_fn', 'off', true);
  return public._record_cleaning_internal(t.dustbin_id, auth.uid(), p_notes, p_idempotency_key, t.id);
end $function$;

CREATE OR REPLACE FUNCTION public.submit_report(p_report_type text, p_description text, p_latitude double precision DEFAULT NULL::double precision, p_longitude double precision DEFAULT NULL::double precision, p_location_description text DEFAULT NULL::text, p_contact_info text DEFAULT NULL::text, p_photo_url text DEFAULT NULL::text, p_dustbin_id bigint DEFAULT NULL::bigint)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare rid uuid; v_type public.report_type;
begin
  begin v_type := p_report_type::public.report_type;
  exception when others then raise exception 'Invalid report type'; end;
  if p_description is null or char_length(btrim(p_description)) < 5 then
    raise exception 'Description must be at least 5 characters';
  end if;
  if auth.uid() is null and (p_contact_info is null or char_length(btrim(p_contact_info)) < 3) then
    raise exception 'Contact information is required for anonymous reports';
  end if;
  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'Provide both latitude and longitude, or neither';
  end if;
  insert into public.community_reports
    (reporter_id, report_type, description, latitude, longitude, location_description, photo_url, dustbin_id)
  values
    (auth.uid(), v_type, btrim(p_description), p_latitude, p_longitude,
     nullif(btrim(p_location_description), ''), nullif(btrim(p_photo_url), ''), p_dustbin_id)
  returning id into rid;
  if p_contact_info is not null and char_length(btrim(p_contact_info)) >= 3 then
    insert into public.report_contacts (report_id, contact_info) values (rid, btrim(p_contact_info));
  end if;
  return rid;
end $function$;
