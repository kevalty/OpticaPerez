import Link from "next/link";
import { notFound } from "next/navigation";
import type { CertificadoDatos } from "@/components/certificado-doc";
import { PrintButton } from "@/components/print-button";
import { RecetarioDoc } from "@/components/recetario-doc";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { btnGhost, btnPrimary } from "@/lib/ui";
import { uuid } from "@/lib/validation";

export const metadata = { title: "Recetario · Óptica Pérez" };

// Igual que el certificado: la recepcionista solo recibe de la BD lo que se imprime (certificado_recepcion).
export default async function RecetarioPage({ params }: PageProps<"/dashboard/turnos/[id]/recetario">) {
  await requireRole("recepcionista", "doctor", "administrador");
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("certificado_recepcion", { p_turno: id });
  if (error) console.error("recetario fallo:", error.code);
  const c = data as CertificadoDatos | null;

  if (!c) {
    const mensaje = error
      ? "No se pudo cargar el recetario. Inténtalo de nuevo."
      : "Este turno todavía no tiene recetario. Solo se puede imprimir cuando el doctor guardó la ficha y el turno está en “Atendido”.";
    return (
      <>
        <div><Link href="/dashboard/turnos" className={btnGhost}>← Volver a turnos</Link></div>
        <p role="alert" className="max-w-xl rounded-xl bg-amber-50 px-4 py-3 text-sm text-brand">{mensaje}</p>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/dashboard/turnos" className={btnGhost}>← Volver a turnos</Link>
        <PrintButton className={btnPrimary} />
      </div>
      {!c.recetario && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-brand print:hidden">
          El doctor no llenó el recetario en esta consulta. Se imprime la hoja con los datos del paciente y el resto en blanco.
        </p>
      )}
      <RecetarioDoc c={c} />
    </>
  );
}
