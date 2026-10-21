import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fechaHoraLocal } from "@/lib/time";
import { card } from "@/lib/ui";
import { optionalUuid } from "@/lib/validation";

export const metadata = { title: "Movimientos de inventario · Óptica Pérez" };

type Mov = { id: string; fecha: string; tipo: "entrada" | "salida"; cantidad: number; nota: string | null; producto: string; usuario: string | null; venta_id: string | null; venta_numero: number | null };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Historial de entradas y salidas (solo se anade, nunca se edita). Los nombres salen de una funcion de la base: recepcion no lee la tabla de usuarios.
export default async function MovimientosPage({ searchParams }: PageProps<"/dashboard/inventario/movimientos">) {
  const esAdmin = (await requireRole("recepcionista", "administrador")).rol === "administrador"; // recepcion solo ve sus propias ventas (RLS)
  const sp = await searchParams;
  const producto = optionalUuid(one(sp.producto) ?? null);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("inventario_movimientos", { p_producto: producto, p_limite: 150 });
  if (error) console.error("movimientos fallo:", error.code);
  const movs = (data ?? []) as Mov[];

  return (
    <>
      <div>
        <Link href="/dashboard/inventario" className="inline-flex min-h-11 items-center text-sm text-iris hover:underline">← Inventario</Link>
        <h1 className="text-2xl font-semibold text-brand">Movimientos{producto && movs[0] ? ` · ${movs[0].producto}` : ""}</h1>
        {producto && <Link href="/dashboard/inventario/movimientos" className="text-sm text-iris hover:underline">Ver todos los productos</Link>}
      </div>
      {error && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">No se pudo cargar el historial (puede faltar la migración 0015). Avisa al administrador.</p>}

      <section className={card}>
        {movs.length === 0 ? <p className="text-sm text-brand-dark/70">Todavía no hay movimientos.</p> : (
          <ul className="divide-y divide-brand/10 text-sm">
            {movs.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${m.tipo === "entrada" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                    {m.tipo === "entrada" ? "+" : "−"}{m.cantidad}
                  </span>
                  <strong className="text-brand">{m.producto}</strong>
                  <span className="text-brand-dark/70">
                    {m.venta_id && m.venta_numero != null
                      ? <>{m.tipo === "salida" ? "Venta" : "Anulación de venta"} {esAdmin ? <Link href={`/dashboard/ventas/${m.venta_id}`} className="text-iris underline">N.º {String(m.venta_numero).padStart(6, "0")}</Link> : `N.º ${String(m.venta_numero).padStart(6, "0")}`}</>
                      : m.nota ?? "Ajuste manual"}
                  </span>
                </span>
                <span className="text-brand-dark/60">{fechaHoraLocal(m.fecha)} · {m.usuario ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
