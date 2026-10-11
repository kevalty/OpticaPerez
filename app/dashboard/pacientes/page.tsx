import Link from "next/link";
import { BuscadorPacientes } from "@/components/buscador-pacientes";
import { requireRole } from "@/lib/auth";
import { LIMITE_PACIENTES, type PacienteFila } from "@/lib/pacientes";
import { createClient } from "@/lib/supabase/server";
import { btnPrimary } from "@/lib/ui";

export const metadata = { title: "Pacientes · Óptica Pérez" };

export default async function PacientesPage() {
  await requireRole("recepcionista", "doctor", "administrador");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .select("id, nombre, documento, telefono, edad")
    .is("deleted_at", null)
    .order("nombre", { ascending: true })
    .limit(LIMITE_PACIENTES);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-brand">Pacientes</h1>
        <Link href="/dashboard/pacientes/nuevo" className={btnPrimary}>
          + Nuevo paciente
        </Link>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo cargar la lista de pacientes.</p>}

      <BuscadorPacientes inicial={(data ?? []) as PacienteFila[]} hrefBase="/dashboard/pacientes/" autoFocus={false} />
    </>
  );
}
