create table organization_audit_logs (
    id uuid primary key default gen_random_uuid(),

    organization_id uuid not null
        references organizations(id)
        on delete cascade,

    actor_user_id uuid
        references auth.users(id)
        on delete set null,
    
    actor_email text,

    action text not null,
    
    details jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now()
);

create index organization_audit_logs_org_created_idx
on organization_audit_logs (
    organization_id,
    created_at desc
);