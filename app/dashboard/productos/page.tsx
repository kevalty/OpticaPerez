import Link from "next/link";
import { Miniatura } from "@/components/miniatura";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { btnGhost, btnPrimary, card, inputCls } from "@/lib/ui";
import { cleanSearch } from "@/lib/validation";
import { dinero, tipoLabel } from "@/lib/ventas";

export const metadata = { title: "Productos · Óptica Pérez" };

type P = { id: string; nombre: string; tipo: string; precio: number; stock: number; stock_minimo: number; controla_stock: boolean; codigo: string | null; foto_path: string | null };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const AVISO: Record<string, string> = { creado: "Producto creado.", guardado: "Cambios guardados.", archivado: "Producto archivado." };

// Catalogo de productos. Solo el administrador lo edita (RLS); los nombres de productos no son datos personales, por eso la busqueda va en la URL.
export default async function ProductosPage({ searchParams }: PageProps<"/dashboard/productos">) {
  await requireRole("administrador");
  const sp = await searchParams;
  const q = cleanSearch(sp.q);
  const ok = AVISO[one(sp.ok) ?? ""];

  const supabase = await createClient();
  let query = supabase.from("products").select("id, nombre, tipo, precio, stock, stock_minimo, controla_stock, codigo, foto_path").is("deleted_at", null).order("tipo").order("nombre").limit(300);
  if (q) query = query.or(`nombre.ilike.%${q}%,codigo.ilike.%${q}%`);
  const { data, error } = await query;
  const productos = (data ?? []) as P[];
  const bajos = productos.filter((p) => p.controla_stock && p.stock <= p.stock_minimo).length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-brand">Productos</h1>
        <Link href="/dashboard/productos/nuevo" className={btnPrimary}>+ Nuevo producto</Link>
      </div>

      {ok && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo cargar el catálogo (puede faltar la migración 0008).</p>}

      <form action="/dashboard/productos" className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por nombre o código" maxLength={60} autoComplete="off" className={inputCls} />
        <button className={btnGhost}>Buscar</button>
      </form>
      {bajos > 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{bajos} producto{bajos === 1 ? "" : "s"} con stock bajo o agotado.</p>}

      <section className={`${card} divide-y divide-brand/10 p-0`}>
        {productos.length === 0 ? (
          <p className="p-5 text-sm text-brand-dark/70">{q ? "No hay productos que coincidan." : "Aún no hay productos. Crea el primero con “+ Nuevo producto”."}</p>
        ) : (
          productos.map((p) => {
            const bajo = p.controla_stock && p.stock <= p.stock_minimo;
            return (
              <Link key={p.id} href={`/dashboard/productos/${p.id}`} className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3 hover:bg-iris-light/50 focus-visible:bg-iris-light">
                <span className="flex min-w-0 items-center gap-3">
                  <Miniatura id={p.id} tiene={Boolean(p.foto_path)} className="size-12" />
                  <span>
                  <span className="font-medium text-brand">{p.nombre}</span>
                  <span className="ml-2 text-xs text-brand-dark/60">{tipoLabel(p.tipo)}{p.codigo ? ` · ${p.codigo}` : ""}</span>
                  </span>
                </span>
                <span className="flex items-center gap-3 text-sm">
                  <span className="font-semibold text-brand">{dinero(p.precio)}</span>
                  {p.controla_stock ? (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${bajo ? "bg-amber-100 text-amber-800" : "bg-iris-light text-brand"}`}>{bajo ? "Stock bajo" : "Stock"} · {p.stock}</span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">A pedido</span>
                  )}
                </span>
              </Link>
            );
          })
        )}
      </section>
    </>
  );
}
