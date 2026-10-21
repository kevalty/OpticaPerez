import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { TIPOS_PRODUCTO } from "@/lib/ventas";
import { crearProducto } from "../actions";
import { ProductoForm } from "../producto-form";

export const metadata = { title: "Nuevo producto · Óptica Pérez" };

export default async function NuevoProductoPage({ searchParams }: PageProps<"/dashboard/productos/nuevo">) {
  await requireRole("administrador");
  const sp = await searchParams;
  const tipo = TIPOS_PRODUCTO.find((t) => t.id === sp.tipo)?.id;
  return (
    <>
      <div>
        <Link href="/dashboard/productos" className="inline-flex min-h-11 items-center text-sm text-iris hover:underline">← Productos</Link>
        <h1 className="text-2xl font-semibold text-brand">Nuevo producto</h1>
      </div>
      {sp.ok === "creado" && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Producto creado. Puedes cargar el siguiente.</p>}
      <ProductoForm key={tipo ?? "nuevo"} action={crearProducto} initial={tipo ? { tipo } : undefined} nuevo submitLabel="Crear producto" />
    </>
  );
}
