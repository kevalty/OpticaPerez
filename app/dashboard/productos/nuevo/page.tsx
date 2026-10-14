import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { crearProducto } from "../actions";
import { ProductoForm } from "../producto-form";

export const metadata = { title: "Nuevo producto · Óptica Pérez" };

export default async function NuevoProductoPage() {
  await requireRole("administrador");
  return (
    <>
      <div>
        <Link href="/dashboard/productos" className="inline-flex min-h-11 items-center text-sm text-iris hover:underline">← Productos</Link>
        <h1 className="text-2xl font-semibold text-brand">Nuevo producto</h1>
      </div>
      <ProductoForm action={crearProducto} nuevo submitLabel="Crear producto" />
    </>
  );
}
