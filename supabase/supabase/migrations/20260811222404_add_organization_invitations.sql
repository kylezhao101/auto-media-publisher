create table public.organization_invitations (
    id uuid primary key default gen_random_uuid(),

    organization_id uuid not null
        references public.organizations(id)
        on delete cascade,

    email text not null,

    role text not null
        check (role in ('admin', 'publisher', 'member')),

    token uuid not null default gen_random_uuid(),

    invited_by uuid not null
        references auth.users(id)
        on delete cascade,

    expires_at timestamptz not null
        default (now() + interval '7 days'),

    accepted_at timestamptz,

    created_at timestamptz not null default now(),

    unique (organization_id, email)
);