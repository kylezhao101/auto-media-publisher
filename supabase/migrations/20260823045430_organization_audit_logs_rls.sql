alter table organization_audit_logs
enable row level security;

create policy "Organization members can view audit logs"
on organization_audit_logs
for select
to authenticated
using (
    exists (
        select 1
        from organization_members
        where organization_members.organization_id =
            organization_audit_logs.organization_id
        and organization_members.user_id = auth.uid()
    )
);