create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger presets_set_updated_at
before update on public.presets
for each row
execute function public.set_updated_at();