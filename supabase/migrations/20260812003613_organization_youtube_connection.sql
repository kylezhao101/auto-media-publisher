create table public.youtube_connections (
    id uuid primary key default gen_random_uuid(),

    organization_id uuid not null unique
        references public.organizations(id)
        on delete cascade,

    channel_id text,
    channel_name text,

    refresh_token_encrypted text not null,

    scopes text[] not null default '{}',

    connected_by uuid not null
        references auth.users(id),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create trigger youtube_connections_set_updated_at
before update on public.youtube_connections
for each row
execute function public.set_updated_at();

alter table public.youtube_connections
enable row level security;

create policy "Members can view YouTube connection"
on public.youtube_connections
for select
to authenticated
using (
    organization_id in (
        select organization_id
        from public.organization_members
        where user_id = (select auth.uid())
    )
);

create policy "Admins can manage YouTube connection"
on public.youtube_connections
for all
to authenticated
using (
    organization_id in (
        select organization_id
        from public.organization_members
        where user_id = (select auth.uid())
          and role in ('owner', 'admin')
    )
)
with check (
    organization_id in (
        select organization_id
        from public.organization_members
        where user_id = (select auth.uid())
          and role in ('owner', 'admin')
    )
);