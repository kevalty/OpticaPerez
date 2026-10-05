import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { requireRole } from "@/lib/auth";
import { RX_CAMPOS, formatRx } from "@/lib/ficha";
import { createClient } from "@/lib/supabase/server";
import { formatDateLong } from "@/lib/time";
import { uuid } from "@/lib/validation";
import { btnGhost, btnPrimary } from "@/lib/ui";

export const metadata = { title: "Receta · Óptica Pérez" };

type Receta = {
  paciente: string;
  tipo_documento: string;
  documento: string | null;
  fecha: string;
  optometrista: string | null;
  indicaciones: string | null;
  color: string | null;
  bifocal: boolean;
  rx: { ojo: string; esfera: number | null; cilindro: number | null; eje: number | null; av: string | null; add: number | null; dp: number | null }[];
};

const v = (x: string | number | null) => (x == null || x === "" ? "—" : String(x));

// Receta imprimible. La recepcionista solo recibe de la BD la tabla Rx y las indicaciones que escribio
// el doctor (funcion receta_recepcion), nunca la ficha medica completa.
export default async function RecetaPage({ params }: PageProps<"/dashboard/turnos/[id]/receta">) {
  await requireRole("recepcionista", "doctor", "administrador");
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("receta_recepcion", { p_turno: id });
  if (error) console.error("receta fallo:", error.code);
  const r = data as Receta | null;
  if (!r) notFound();

  return (
    <>
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href="/dashboard/turnos" className={btnGhost}>← Volver a turnos</Link>
        <PrintButton className={btnPrimary} />
      </div>

      <article className="mx-auto flex w-full max-w-2xl flex-col gap-5 rounded-2xl bg-white p-8 ring-1 ring-brand/10 print:max-w-none print:rounded-none print:p-0 print:ring-0">
        <header className="flex items-center justify-between gap-4 border-b border-brand/20 pb-4">
          <Image src="/logo.png" alt="Óptica Pérez" width={360} height={249} className="h-auto w-28" />
          <div className="text-right text-sm text-brand-dark/70">
            <p className="font-semibold text-brand">Receta</p>
            <p className="first-letter:uppercase">{formatDateLong(r.fecha)}</p>
          </div>
        </header>

        <section className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-brand-dark/50">Paciente</p>
            <p className="font-medium text-brand">{r.paciente}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-brand-dark/50">{r.tipo_documento === "pasaporte" ? "Pasaporte" : "Cédula"}</p>
            <p className="text-brand-dark">{v(r.documento)}</p>
          </div>
        </section>

        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-brand/20 text-xs uppercase tracking-wide text-brand-dark/50">
              <th className="py-2 pr-3 font-medium">Ojo</th>
              {RX_CAMPOS.map((c) => (
                <th key={c.key} className="py-2 pr-3 font-medium">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.rx.map((x) => (
              <tr key={x.ojo} className="border-b border-brand/10">
                <th className="py-2 pr-3 font-medium text-brand">{x.ojo}</th>
                {RX_CAMPOS.map((c) => (
                  <td key={c.key} className="py-2 pr-3">{formatRx(c.key, x[c.key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm text-brand-dark">Color de lente: {v(r.color)} · Bifocal: {r.bifocal ? "Sí" : "No"}</p>

        {r.indicaciones && (
          <section className="text-sm">
            <p className="text-xs uppercase tracking-wide text-brand-dark/50">Indicaciones</p>
            <p className="whitespace-pre-wrap text-brand-dark">{r.indicaciones}</p>
          </section>
        )}

        <footer className="mt-6 border-t border-brand/20 pt-3 text-sm text-brand-dark/70">
          Optometrista: {v(r.optometrista)}
        </footer>
      </article>
    </>
  );
}
