import Link from "next/link";
import { notFound } from "next/navigation";
import { CertificadoDoc, type CertificadoDatos } from "@/components/certificado-doc";
import { PrintButton } from "@/components/print-button";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { btnGhost, btnPrimary } from "@/lib/ui";
import { uuid } from "@/lib/validation";

export const metadata = { title: "Certificado · Óptica Pérez" };

// La recepcionista solo recibe de la BD lo que lleva el certificado (funcion certificado_recepcion),
// nunca la ficha medica completa.
export default async function CertificadoPage({ params }: PageProps<"/dashboard/turnos/[id]/certificado">) {
  await requireRole("recepcionista", "doctor", "administrador");
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("certificado_recepcion", { p_turno: id });
  if (error) console.error("certificado fallo:", error.code);
  const c = data as CertificadoDatos | null;

  if (!c) {
    // PGRST202 = la funcion no existe en la BD (migracion 0005 sin aplicar)
    const mensaje = error
      ? error.code === "PGRST202"
        ? "Falta aplicar la migración 0005_certificado.sql en Supabase. Avisa al administrador."
        : "No se pudo cargar el certificado. Inténtalo de nuevo."
      : "Este turno todavía no tiene certificado. Solo se puede imprimir cuando el doctor guardó la ficha y el turno está en “Atendido”.";
    return (
      <>
        <div>
          <Link href="/dashboard/turnos" className={btnGhost}>← Volver a turnos</Link>
        </div>
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

      {c.indicaciones && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-brand print:hidden">
          <strong>Indicaciones del doctor para recepción:</strong> {c.indicaciones}
        </p>
      )}
      {!c.registro_msp && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">
          Este doctor no tiene registro M.S.P. cargado, por eso no aparece bajo la firma. Un administrador puede agregarlo.
        </p>
      )}

      <CertificadoDoc c={c} />
    </>
  );
}
