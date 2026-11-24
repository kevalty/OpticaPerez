import Image from "next/image";
import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import { ReporteVista } from "@/components/reporte-vista";
import { requireRole } from "@/lib/auth";
import { NEGOCIO } from "@/lib/negocio";
import { cargarReporte, leerRango } from "@/lib/reportes-server";
import { createClient } from "@/lib/supabase/server";
import { fechaHoraLocal } from "@/lib/time";
import { btnGhost, btnPrimary } from "@/lib/ui";

export const metadata = { title: "Reporte de ventas · Óptica Pérez" };

// Hoja para imprimir o guardar como PDF (en el dialogo de impresion: "Guardar como PDF").
export default async function ImprimirReportePage({ searchParams }: PageProps<"/dashboard/reportes/imprimir">) {
  await requireRole("administrador");
  const { desde, hasta } = leerRango(await searchParams);
  const { r, error } = await cargarReporte(await createClient(), desde, hasta);
  const f = (iso: string) => iso.split("-").reverse().join("/");

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/dashboard/reportes?desde=${desde}&hasta=${hasta}`} className={btnGhost}>← Volver a reportes</Link>
        <PrintButton className={btnPrimary} />
      </div>
      <p className="text-sm text-brand-dark/70 print:hidden">En el cuadro de impresión elige «Guardar como PDF» como destino.</p>
      {error && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</p>}
      {r && (
        <article className="mx-auto flex w-full max-w-[210mm] flex-col gap-4 bg-white p-6 text-brand-dark print:max-w-none print:p-0">
          <header className="flex items-center gap-4 border-b-2 border-brand pb-3">
            <Image src="/logo-icon.png" alt="Óptica Pérez" width={442} height={384} className="h-auto w-16 shrink-0" />
            <div className="flex-1 text-brand">
              <p className="text-2xl font-extrabold tracking-wide">{NEGOCIO.nombre}</p>
              <p className="text-xs">Reporte de ventas</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold text-brand">Del {f(desde)} al {f(hasta)}</p>
              <p className="text-xs text-brand-dark/60">Generado: {fechaHoraLocal(new Date().toISOString())}</p>
            </div>
          </header>
          <ReporteVista r={r} />
        </article>
      )}
    </>
  );
}
