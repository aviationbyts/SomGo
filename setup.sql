create table public.userdata(user_id uuid primary key references auth.users(id) on delete cascade, data jsonb not null default '{}', updated_at timestamptz default now());
alter table public.userdata enable row level security;
create policy "eigen rij lezen" on public.userdata for select using (auth.uid()=user_id);
create policy "eigen rij maken" on public.userdata for insert with check (auth.uid()=user_id);
create policy "eigen rij wijzigen" on public.userdata for update using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "eigen rij verwijderen" on public.userdata for delete using (auth.uid()=user_id);
create or replace function public.delete_own_account() returns void language sql security definer set search_path='' as $$ delete from auth.users where id=auth.uid(); $$;
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
