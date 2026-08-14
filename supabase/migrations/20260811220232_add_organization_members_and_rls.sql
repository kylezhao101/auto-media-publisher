-- Extensions
create extension if not exists pgcrypto;


-- Organization members
create table public.organization_members (
    organization_id uuid not null
        references public.organizations(id)
        on delete cascade,

    user_id uuid not null
        references auth.users(id)
        on delete cascade,

    role text not null default 'member'
        check (role in ('owner', 'admin', 'publisher', 'member')),

    created_at timestamptz not null default now(),

    primary key (organization_id, user_id)
);

create index organization_members_user_id_idx
    on public.organization_members(user_id);



-- Generic updated_at trigger function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;


create trigger organizations_set_updated_at
before update on public.organizations
for each row
execute function public.set_updated_at();


-- Enable RLS
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.presets enable row level security;


-- Organizations: members can view orgs they belong to
create policy "Members can view their organizations"
on public.organizations
for select
to authenticated
using (
    id in (
        select organization_id
        from public.organization_members
        where user_id = (select auth.uid())
    )
);


-- Organization members: users can view memberships
create policy "Members can view organization members"
on public.organization_members
for select
to authenticated
using (
    organization_id in (
        select organization_id
        from public.organization_members
        where user_id = (select auth.uid())
    )
);


-- Presets: all members can view
create policy "Members can view organization presets"
on public.presets
for select
to authenticated
using (
    organization_id in (
        select organization_id
        from public.organization_members
        where user_id = (select auth.uid())
    )
);


-- Presets: owners/admins can create
create policy "Admins can create presets"
on public.presets
for insert
to authenticated
with check (
    organization_id in (
        select organization_id
        from public.organization_members
        where user_id = (select auth.uid())
          and role in ('owner', 'admin')
    )
);


-- Presets: owners/admins can update
create policy "Admins can update presets"
on public.presets
for update
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


-- Presets: owners/admins can delete
create policy "Admins can delete presets"
on public.presets
for delete
to authenticated
using (
    organization_id in (
        select organization_id
        from public.organization_members
        where user_id = (select auth.uid())
          and role in ('owner', 'admin')
    )
);