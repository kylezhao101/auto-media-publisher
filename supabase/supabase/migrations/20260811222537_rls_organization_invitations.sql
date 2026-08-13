create policy "Admins can view organization invitations"
on public.organization_invitations
for select
to authenticated
using (
    organization_id in (
        select organization_id
        from public.organization_members
        where user_id = (select auth.uid())
          and role in ('owner', 'admin')
    )
);

create policy "Admins can create organization invitations"
on public.organization_invitations
for insert
to authenticated
with check (
    organization_id in (
        select organization_id
        from public.organization_members
        where user_id = (select auth.uid())
          and role in ('owner', 'admin')
    )
    and invited_by = (select auth.uid())
);

create policy "Admins can delete organization invitations"
on public.organization_invitations
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