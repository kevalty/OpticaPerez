import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { card } from "@/lib/ui";
import { uuid } from "@/lib/validation";
import { actualizarProducto, ajustarStock, archivarProducto } from "../actions";
import { AjusteStockForm, ProductoForm } from "../producto-form";

export const metadata = { title: "Producto · Óptica Pérez" };

export default async function ProductoPage({ params }: PageProps<"/dashboard/productos/[id]">) {
  await requireRole("administrador");
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: p } = await supabase.from("products").select("id, nombre, tipo, codigo, precio, stock, stock_minimo, controla_stock").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!p) notFound();

  return (
    <>
      <div>
        <Link href="/dashboard/productos" className="inline-flex min-h-11 items-center text-sm text-iris hover:underline">← Productos</Link>
        <h1 className="text-2xl font-semibold text-brand">{p.nombre}</h1>
      </div>
      <ProductoForm action={actualizarProducto.bind(null, id)} initial={p} submitLabel="Guardar cambios" />

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
