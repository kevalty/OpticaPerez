-- Optica Perez - Semana 7 (ajuste): foto de cada producto y evidencia en la venta.
--   - products.foto_path    : foto actual del producto (Storage, bucket privado "productos")
--   - sale_items.foto_path  : copia de la foto al momento de vender (evidencia de lo que se llevo el cliente);
--                             un trigger la copia sola, crear_venta() no cambia
--   - Storage: solo el personal lee; solo el administrador sube, cambia o borra. El navegador nunca habla con Storage:
--     las fotos se suben y se muestran a traves del servidor (/dashboard/fotos/...).
-- Se puede ejecutar varias veces.

alter table public.products add column if not exists foto_path text check (char_length(foto_path) <= 200);
alter table public.sale_items add column if not exists foto_path text check (char_length(foto_path) <= 200);

create or replace function public.sale_items_foto() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.foto_path is null then
    select p.foto_path into new.foto_path from public.products p where p.id = new.product_id;
  end if;
  return new;
end $$;
revoke all on function public.sale_items_foto() from public, anon, authenticated;
drop trigger if exists sale_items_foto on public.sale_items;
create trigger sale_items_foto before insert on public.sale_items for each row execute function public.sale_items_foto();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('productos', 'productos', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists productos_fotos_select on storage.objects;
create policy productos_fotos_select on storage.objects for select to authenticated
  using (bucket_id = 'productos' and public.has_role('recepcionista', 'doctor', 'administrador', 'otro'));
drop policy if exists productos_fotos_insert on storage.objects;
create policy productos_fotos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'productos' and public.has_role('administrador')
              and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{32}\.(jpg|png|webp)$');
drop policy if exists productos_fotos_delete on storage.objects;
create policy productos_fotos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'productos' and public.has_role('administrador'));
