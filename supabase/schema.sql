-- Public shared board. Run in the Supabase SQL Editor before deployment.
-- Anyone with the deployed URL can read and change cards.

create table if not exists public.kanban_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date date,
  sort_order double precision not null default 0,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Upgrade the prototype, which used the status value "progress".
alter table public.kanban_tasks drop constraint if exists kanban_tasks_status_check;
update public.kanban_tasks set status = 'doing' where status = 'progress';
alter table public.kanban_tasks add constraint kanban_tasks_status_check
  check (status in ('todo', 'doing', 'done'));

create index if not exists kanban_tasks_status_created_idx
  on public.kanban_tasks (status, created_at);

alter table public.kanban_tasks enable row level security;
revoke all on table public.kanban_tasks from anon, authenticated;
grant select, insert, update, delete on table public.kanban_tasks to anon;

drop policy if exists "Members can read shared tasks" on public.kanban_tasks;
drop policy if exists "Members can create shared tasks" on public.kanban_tasks;
drop policy if exists "Members can edit shared tasks" on public.kanban_tasks;
drop policy if exists "Members can delete shared tasks" on public.kanban_tasks;
drop policy if exists "Anyone can read board" on public.kanban_tasks;
drop policy if exists "Anyone can add cards" on public.kanban_tasks;
drop policy if exists "Anyone can update cards" on public.kanban_tasks;
drop policy if exists "Anyone can delete cards" on public.kanban_tasks;

create policy "Anyone can read board" on public.kanban_tasks
  for select to anon using (true);
create policy "Anyone can add cards" on public.kanban_tasks
  for insert to anon with check (true);
create policy "Anyone can update cards" on public.kanban_tasks
  for update to anon using (true) with check (true);
create policy "Anyone can delete cards" on public.kanban_tasks
  for delete to anon using (true);
