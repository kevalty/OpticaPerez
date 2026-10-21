import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { card } from "@/lib/ui";
import { urlFotoProducto } from "@/lib/fotos";
import { uuid } from "@/lib/validation";
import { actualizarProducto, ajustarStock, archivarProducto } from "../actions";
import { AjusteStockForm, ProductoForm } from "../producto-form";

export const metadata = { title: "Producto · Óptica Pérez" };

export default async function ProductoPage({ params, searchParams }: PageProps<"/dashboard/productos/[id]">) {
  await requireRole("administrador");
  const { id } = await params;
  const sp = await searchParams;
  if (!uuid.safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: p } = await supabase.from("products").select("id, nombre, tipo, codigo, precio, stock, stock_minimo, controla_stock, foto_path").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!p) notFound();

  return (
    <>
      <div>
        <Link href="/dashboard/productos" className="inline-flex min-h-11 items-center text-sm text-iris hover:underline">← Productos</Link>
        <h1 className="text-2xl font-semibold text-brand">{p.nombre}</h1>
      </div>
      {sp.aviso === "foto" && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">El producto se creó, pero la foto no se pudo subir. Vuelve a intentarlo aquí abajo.</p>}
      <ProductoForm action={actualizarProducto.bind(null, id)} initial={p} submitLabel="Guardar cambios" fotoActual={p.foto_path ? urlFotoProducto(id) : null} />

      {p.controla_stock && (
        <section className={`${card} max-w-xl`}>
          <h2 className="font-semibold text-brand">Stock actual: {p.stock}</h2>
          <p className="mb-3 text-xs text-brand-dark/60">Las entradas y salidas quedan en el historial de movimientos.</p>
          <AjusteStockForm action={ajustarStock.bind(null, id)} stock={p.stock} />
        </section>
      )}

      <form action={archivarProducto} className="pt-2">
        <input type="hidden" name="id" value={id} />
        <ConfirmButton message="¿Archivar este producto? Sale del catálogo; las ventas anteriores lo conservan." className="text-sm text-red-700 hover:underline">
          Archivar producto
        </ConfirmButton>
      </form>
    </>
  );
}
