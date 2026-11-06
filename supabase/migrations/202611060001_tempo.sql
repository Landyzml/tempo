-- New Tempo tables only. Run once in a fresh Supabase project.
-- Existing StudyFlow users/data require a separately reviewed import.
begin;
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  description text not null default '' check (char_length(description)<=10000),
  due_date date,
  due_time time without time zone,
  important boolean not null default false,
  manual_urgency boolean not null default false,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id),
  constraint due_time_requires_date check(due_time is null or due_date is not null)
);
create table public.calendar_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check(kind in ('event','session')),
  title text not null check(char_length(btrim(title)) between 1 and 300),
  description text not null default '' check(char_length(description)<=10000),
  event_date date not null,
  start_time time without time zone,
  end_time time without time zone,
  all_day boolean not null default false,
  color text not null default 'blue' check(color in ('blue','green','orange')),
  related_task_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_task_same_owner foreign key(related_task_id,user_id) references public.tasks(id,user_id) on delete cascade,
  constraint entry_task_kind check((kind='session' and related_task_id is not null) or (kind='event' and related_task_id is null)),
  constraint valid_time_range check((all_day and start_time is null and end_time is null) or (not all_day and start_time is not null and end_time is not null and end_time>start_time))
);
create index tasks_owner_due on public.tasks(user_id,due_date);
create index calendar_owner_date on public.calendar_entries(user_id,event_date);
create index calendar_related_task on public.calendar_entries(related_task_id,user_id);
create function public.tempo_timestamps() returns trigger language plpgsql set search_path='' as $$
begin
  new.updated_at=now();
  if TG_OP='UPDATE' then
    new.created_at=old.created_at;
    if new.id<>old.id or new.user_id<>old.user_id then
      raise exception 'Record identity and ownership are immutable';
    end if;
  end if;
  if TG_TABLE_NAME='tasks' then
    if new.completed then
      if TG_OP='INSERT' then new.completed_at=now();
      elsif not old.completed then new.completed_at=now();
      else new.completed_at=old.completed_at; end if;
    else new.completed_at=null; end if;
  end if;
  return new;
end $$;
create trigger tasks_timestamps before insert or update on public.tasks for each row execute function public.tempo_timestamps();
create trigger calendar_timestamps before insert or update on public.calendar_entries for each row execute function public.tempo_timestamps();
alter table public.tasks enable row level security;
alter table public.calendar_entries enable row level security;
revoke all on public.tasks,public.calendar_entries from anon,authenticated;
grant select,insert,update,delete on public.tasks,public.calendar_entries to authenticated;
create policy tasks_select on public.tasks for select to authenticated using ((select auth.uid())=user_id);
create policy tasks_insert on public.tasks for insert to authenticated with check ((select auth.uid())=user_id);
create policy tasks_update on public.tasks for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy tasks_delete on public.tasks for delete to authenticated using ((select auth.uid())=user_id);
create policy calendar_select on public.calendar_entries for select to authenticated using ((select auth.uid())=user_id);
create policy calendar_insert on public.calendar_entries for insert to authenticated with check ((select auth.uid())=user_id);
create policy calendar_update on public.calendar_entries for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy calendar_delete on public.calendar_entries for delete to authenticated using ((select auth.uid())=user_id);
commit;
