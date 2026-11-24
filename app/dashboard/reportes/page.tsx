import Link from "next/link";
import { ReporteVista } from "@/components/reporte-vista";
import { requireRole } from "@/lib/auth";
import { rangosRapidos, type TipoCsv } from "@/lib/reportes";
import { cargarReporte, leerRango } from "@/lib/reportes-server";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/time";
import { btnGhost, btnPrimary, card, inputCls } from "@/lib/ui";

export const metadata = { title: "Reportes · Óptica Pérez" };

// Reportes de ventas (solo administrador). Todo se calcula en la base (reporte_ventas): por dia, tipo, producto, vendedor y metodo de pago.
export default async function ReportesPage({ searchParams }: PageProps<"/dashboard/reportes">) {
  await requireRole("administrador");
  const sp = await searchParams;
  const { desde, hasta } = leerRango(sp);
  const { r, error } = await cargarReporte(await createClient(), desde, hasta);
  const qs = `desde=${desde}&hasta=${hasta}`;
  const atajos = rangosRapidos(todayISO());

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-2xl font-semibold text-brand">Reportes de ventas</h1>
        {r && (
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/reportes/csv?tipo=ventas&${qs}`} prefetch={false} className={btnGhost}>Descargar detalle (CSV)</Link>
            <Link href={`/dashboard/reportes/imprimir?${qs}`} className={btnPrimary}>Imprimir / guardar PDF</Link>
          </div>
        )}
      </div>

      <section className={`${card} flex flex-col gap-3 print:hidden`}>
        <div className="flex flex-wrap gap-2">
          {atajos.map((a) => (
            <Link key={a.id} href={`/dashboard/reportes?desde=${a.desde}&hasta=${a.hasta}`} aria-current={a.desde === desde && a.hasta === hasta ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-medium ${a.desde === desde && a.hasta === hasta ? "bg-brand text-white" : "text-brand ring-1 ring-brand/15 hover:bg-iris-light"}`}>{a.label}</Link>
          ))}
        </div>
        <form action="/dashboard/reportes" className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-brand">Desde<input type="date" name="desde" defaultValue={desde} className={inputCls} /></label>
          <label className="flex flex-col gap-1 text-sm font-medium text-brand">Hasta<input type="date" name="hasta" defaultValue={hasta} className={inputCls} /></label>
          <button className={`${btnGhost} !min-h-11`}>Ver reporte</button>
        </form>
      </section>

      {error && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</p>}
      {r && (
        <>
          <p className="text-sm text-brand-dark/70 print:hidden">Periodo: <strong>{desde.split("-").reverse().join("/")}</strong> al <strong>{hasta.split("-").reverse().join("/")}</strong></p>
          <ReporteVista r={r} csvHref={(t: TipoCsv) => `/dashboard/reportes/csv?tipo=${t}&${qs}`} />
        </>
      )}
    </>
  );
}
