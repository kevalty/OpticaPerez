import Link from "next/link";
import { notFound } from "next/navigation";
import { FichaView } from "@/components/ficha-view";
import { PrintButton } from "@/components/print-button";
import { requireRole } from "@/lib/auth";
import { cargarFichaPorId } from "@/lib/fichas-server";
import { createClient } from "@/lib/supabase/server";
import { formatDateLong } from "@/lib/time";
import { btnGhost, card } from "@/lib/ui";
import { uuid } from "@/lib/validation";

export const metadata = { title: "Ficha médica · Óptica Pérez" };

export default async function FichaPage({ params }: PageProps<"/dashboard/fichas/[id]">) {
  await requireRole("doctor", "administrador");
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();

  const supabase = await createClient();
  const completa = await cargarFichaPorId(supabase, id);
  if (!completa) notFound();

  const [{ data: p }, { data: opts }] = await Promise.all([
    supabase.from("patients").select("id, nombre, tipo_documento, documento, telefono, email, edad").eq("id", completa.patientId).maybeSingle(),
    supabase.rpc("list_optometristas"),
  ]);
  const doctor = ((opts ?? []) as { id: string; nombre: string }[]).find((o) => o.id === completa.ficha.optometrista_id)?.nombre ?? "Otro profesional";

  const datos: [string, string | number | null][] = [
    [p?.tipo_documento === "pasaporte" ? "Pasaporte" : "Cédula", p?.documento ?? null],
    ["Celular", p?.telefono ?? null],
    ["Correo", p?.email ?? null],
    ["Edad", p?.edad != null ? `${p.edad} años` : null],
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/dashboard/fichas" className="text-sm text-iris hover:underline">← Fichas médicas</Link>
        <div className="flex gap-2">
          {p && <Link href={`/dashboard/pacientes/${p.id}`} className={btnGhost}>Ver paciente</Link>}
          <PrintButton className={btnGhost} />
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-brand">{p?.nombre ?? "Paciente"}</h1>
        <p className="text-sm first-letter:uppercase text-brand-dark/70">
          {formatDateLong(completa.ficha.fecha)} · {doctor}
        </p>
      </div>

      <section className={card}>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-4">
          {datos.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs uppercase tracking-wide text-brand-dark/50">{k}</dt>
              <dd className="text-brand-dark">{v ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={card}>
        <FichaView ficha={completa.ficha} rx={completa.rx} cl={completa.cl} />
      </section>
    </>
  );
}
