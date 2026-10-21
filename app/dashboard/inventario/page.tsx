import Link from "next/link";
import { Miniatura } from "@/components/miniatura";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { btnGhost, btnPrimary, card, inputCls } from "@/lib/ui";
import { cleanSearch } from "@/lib/validation";
import { TIPOS_PRODUCTO, tipoLabel } from "@/lib/ventas";

export const metadata = { title: "Inventario · Óptica Pérez" };

type P = { id: string; nombre: string; tipo: string; stock: number; stock_minimo: number; codigo: string | null; foto_path: string | null };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const FILTROS = [
  { id: "todos", titulo: "Todos" },
  { id: "bajo", titulo: "Stock bajo" },
  { id: "agotado", titulo: "Agotados" },
] as const;

// Inventario: consulta de stock con alertas. Recepcion solo mira; el administrador ajusta desde Productos (RLS + ajustar_stock en la base).
export default async function InventarioPage({ searchParams }: PageProps<"/dashboard/inventario">) {
  const user = await requireRole("recepcionista", "administrador");
  const sp = await searchParams;
  const q = cleanSearch(sp.q);
  const filtro = FILTROS.find((f) => f.id === one(sp.f))?.id ?? "todos";
  const tipo = TIPOS_PRODUCTO.find((t) => t.id === one(sp.tipo) && t.id !== "servicio")?.id ?? "";
  const esAdmin = user.rol === "administrador";

  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("id, nombre, tipo, stock, stock_minimo, codigo, foto_path")
    .is("deleted_at", null)
    .eq("controla_stock", true)
    .order("stock")
    .order("nombre")
    .limit(500);
  if (q) query = query.or(`nombre.ilike.%${q}%,codigo.ilike.%${q}%`);
  if (tipo) query = query.eq("tipo", tipo);
  const { data, error } = await query;
  if (error) console.error("inventario fallo:", error.code);
  const todos = (data ?? []) as P[];
  const agotados = todos.filter((p) => p.stock <= 0).length;
  const bajos = todos.filter((p) => p.stock > 0 && p.stock <= p.stock_minimo).length;
  const lista = todos.filter((p) => (filtro === "agotado" ? p.stock <= 0 : filtro === "bajo" ? p.stock <= p.stock_minimo : true));
  const href = (f: string) => `/dashboard/inventario?f=${f}${tipo ? `&tipo=${tipo}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-brand">Inventario</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/inventario/movimientos" className={btnGhost}>Movimientos</Link>
          {esAdmin && <Link href="/dashboard/productos/nuevo" className={btnPrimary}>+ Agregar con foto</Link>}
          {esAdmin && <Link href="/dashboard/productos" className={btnGhost}>Productos y ajustes</Link>}
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo cargar el inventario.</p>}
      {(agotados > 0 || bajos > 0) && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {agotados > 0 && <><strong>{agotados}</strong> agotado{agotados === 1 ? "" : "s"}. </>}
          {bajos > 0 && <><strong>{bajos}</strong> con stock bajo.</>}
        </p>
      )}

      <form action="/dashboard/inventario" className="flex flex-wrap gap-2">
        <input type="hidden" name="f" value={filtro} />
        <input name="q" defaultValue={q} placeholder="Buscar por nombre o código" maxLength={60} autoComplete="off" className={`${inputCls} flex-1`} />
        <select name="tipo" defaultValue={tipo} className={`${inputCls} !w-auto`} aria-label="Tipo">
          <option value="">Todos los tipos</option>
          {TIPOS_PRODUCTO.filter((t) => t.id !== "servicio").map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <button className={btnGhost}>Buscar</button>
      </form>

      <nav aria-label="Filtro" className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <Link key={f.id} href={href(f.id)} aria-current={filtro === f.id ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-medium ${filtro === f.id ? "bg-brand text-white" : "text-brand hover:bg-iris-light"}`}>{f.titulo}</Link>
        ))}
      </nav>

      <section className={`${card} divide-y divide-brand/10 p-0`}>
        {lista.length === 0 ? (
          <p className="p-5 text-sm text-brand-dark/70">{filtro === "todos" && !q && !tipo ? "Aún no hay productos con stock." : "No hay productos que coincidan."}</p>
        ) : (
          lista.map((p) => {
            const agotado = p.stock <= 0;
            const bajo = !agotado && p.stock <= p.stock_minimo;
            return (
              <div key={p.id} className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3">
                <span className="flex min-w-0 items-center gap-3">
                  <Miniatura id={p.id} tiene={Boolean(p.foto_path)} className="size-14" />
                  <span className="min-w-0">
                    <Link href={`/dashboard/inventario/movimientos?producto=${p.id}`} className="block font-medium text-brand hover:underline">{p.nombre}</Link>
                    <span className="text-xs text-brand-dark/60">{tipoLabel(p.tipo)}{p.codigo ? ` · ${p.codigo}` : ""}</span>
                  </span>
                </span>
                <span className="flex items-center gap-3 text-sm">
                  <span className="text-xs text-brand-dark/60">mínimo {p.stock_minimo}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${agotado ? "bg-red-100 text-red-700" : bajo ? "bg-amber-100 text-amber-800" : "bg-iris-light text-brand"}`}>
                    {agotado ? "Agotado" : bajo ? "Stock bajo" : "Stock"} · {p.stock}
                  </span>
                </span>
              </div>
            );
          })
        )}
      </section>
      <p className="text-xs text-brand-dark/60">Los lentes que se hacen a pedido y los servicios no manejan stock y no aparecen aquí. Toca un producto para ver sus movimientos.</p>
    </>
  );
}
