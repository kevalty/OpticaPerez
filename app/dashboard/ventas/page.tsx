import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateLong, horaLocal, isISODate, rangoDia, shiftDate, todayISO } from "@/lib/time";
import { btnGhost, btnPrimary, card } from "@/lib/ui";
import { fechaCorta } from "@/lib/pedidos";
import { dinero } from "@/lib/ventas";

export const metadata = { title: "Ventas · Óptica Pérez" };

type Fila = {
  id: string;
  numero: number;
  fecha: string;
  total: number;
  pagado: number;
  estado: string;
  patients: { nombre: string } | null;
};
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const num = (n: number) => String(n).padStart(6, "0");

// La recepcionista ve solo sus ventas; el administrador, todas (lo fuerza la RLS de la base de datos).
export default async function VentasPage({ searchParams }: PageProps<"/dashboard/ventas">) {
  await requireRole("recepcionista", "administrador");
  const sp = await searchParams;
  const hoy = todayISO();
  const fechaParam = one(sp.fecha);
  const fecha = isISODate(fechaParam) ? fechaParam : hoy;
  const soloSaldo = one(sp.saldo) === "1";

  const supabase = await createClient();
  let query = supabase
    .from("sales")
    .select("id, numero, fecha, total, pagado, estado, patients(nombre)")
    .order("fecha", { ascending: false })
    .limit(200);
  if (soloSaldo) {
    query = query.eq("estado", "activa").gt("saldo", 0);
  } else {
    const { desde, hasta } = rangoDia(fecha);
    query = query.gte("fecha", desde).lt("fecha", hasta);
  }
  const { data, error } = await query;
  const ventas = (data ?? []) as unknown as Fila[];
  const activas = ventas.filter((v) => v.estado === "activa");
  const totalVendido = activas.reduce((a, v) => a + v.total, 0);
  const totalSaldo = activas.reduce((a, v) => a + (v.total - v.pagado), 0);
  const totalCobrado = activas.reduce((a, v) => a + v.pagado, 0);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-brand">Ventas</h1>
        <Link href="/dashboard/ventas/nueva" className={btnPrimary}>+ Nueva venta</Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/dashboard/ventas" aria-current={!soloSaldo ? "page" : undefined} className={`${btnGhost} ${!soloSaldo ? "!border-brand !bg-brand !text-white" : ""}`}>Por día</Link>
        <Link href="/dashboard/ventas?saldo=1" aria-current={soloSaldo ? "page" : undefined} className={`${btnGhost} ${soloSaldo ? "!border-brand !bg-brand !text-white" : ""}`}>Saldos pendientes</Link>
        {!soloSaldo && (
          <>
            <Link href={`/dashboard/ventas?fecha=${shiftDate(fecha, -1)}`} className={btnGhost} aria-label="Día anterior">←</Link>
            <p className="min-w-52 text-center font-medium first-letter:uppercase text-brand">{formatDateLong(fecha)}</p>
            <Link href={`/dashboard/ventas?fecha=${shiftDate(fecha, 1)}`} className={btnGhost} aria-label="Día siguiente">→</Link>
            {fecha !== hoy && <Link href="/dashboard/ventas" className={btnGhost}>Hoy</Link>}
          </>
        )}
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo cargar las ventas. Si el problema continúa, avisa al administrador (puede faltar la migración 0008).</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [soloSaldo ? "Con saldo" : "Vendido", dinero(totalVendido), `${activas.length} venta${activas.length === 1 ? "" : "s"}`],
          ["Cobrado", dinero(totalCobrado), ""],
          ["Saldo pendiente", dinero(totalSaldo), ""],
        ].map(([k, v, sub]) => (
          <div key={k} className={card}>
            <p className="text-xs uppercase tracking-wide text-brand-dark/50">{k}</p>
            <p className="text-2xl font-bold text-brand">{v}</p>
            {sub && <p className="text-xs text-brand-dark/60">{sub}</p>}
          </div>
        ))}
      </div>

      <section className={`${card} divide-y divide-brand/10 p-0`}>
        {ventas.length === 0 ? (
          <p className="p-5 text-sm text-brand-dark/70">{soloSaldo ? "No hay saldos pendientes." : "No hay ventas en este día."}</p>
        ) : (
          ventas.map((v) => {
            const saldo = v.total - v.pagado;
            return (
              <div key={v.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-1 hover:bg-iris-light/30">
                <Link href={`/dashboard/ventas/${v.id}`} className="flex min-h-14 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 focus-visible:bg-iris-light">
                  <span>
                    <span className="font-mono text-sm text-brand-dark/60">N.º {num(v.numero)}</span>
                    <span className="ml-3 font-medium text-brand">{v.patients?.nombre ?? "Mostrador"}</span>
                    <span className="ml-2 text-xs text-brand-dark/60">{soloSaldo ? fechaCorta(v.fecha) : horaLocal(v.fecha)}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-semibold text-brand">{dinero(v.total)}</span>
                    {v.estado === "anulada" ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">Anulada</span>
                    ) : saldo > 0 ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">Saldo {dinero(saldo)}</span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">Pagada</span>
                    )}
                  </span>
                </Link>
                {v.estado === "activa" && saldo > 0 && (
                  <Link href={`/dashboard/ventas/${v.id}#abono`} className={btnPrimary}>Cobrar saldo</Link>
                )}
              </div>
            );
          })
        )}
      </section>
    </>
  );
}
