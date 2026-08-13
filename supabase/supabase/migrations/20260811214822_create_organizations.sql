create table public.organizations (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    created_at timestamptz not null default now()
);

create table public.presets (
    id uuid primary key default gen_random_uuid(),

    organization_id uuid not null
        references public.organizations(id)
        on delete cascade,

    name text not null,

    title_template text not null default '',
    description_template text not null default '',

    visibility text not null default 'unlisted'
        check (visibility in ('private', 'unlisted', 'public')),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique (organization_id, name)
);