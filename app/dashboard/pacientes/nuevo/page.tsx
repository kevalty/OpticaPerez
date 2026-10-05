import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/time";
import { createPatient } from "../actions";
import { PatientForm } from "../patient-form";

export const metadata = { title: "Nuevo paciente · Óptica Pérez" };

export default async function NuevoPacientePage() {
  const user = await requireRole("recepcionista", "doctor", "administrador");
  const puedeDarTurno = user.rol === "recepcionista" || user.rol === "administrador";

  let turno: { hoy: string; optometristas: { id: string; nombre: string }[] } | undefined;
  if (puedeDarTurno) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("list_optometristas");
    turno = { hoy: todayISO(), optometristas: (data as { id: string; nombre: string }[] | null) ?? [] };
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-brand">Nuevo paciente</h1>
      <PatientForm
        action={createPatient}
        submitLabel="Registrar paciente"
        cancelHref="/dashboard/pacientes"
        turno={turno}
      />
    </>
  );
}
