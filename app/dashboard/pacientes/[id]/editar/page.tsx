import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation";
import { updatePatient } from "../../actions";
import { PatientForm } from "../../patient-form";

export const metadata = { title: "Editar paciente · Óptica Pérez" };

export default async function EditarPacientePage({ params }: PageProps<"/dashboard/pacientes/[id]/editar">) {
  await requireRole("recepcionista", "doctor", "administrador");
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: p } = await supabase
    .from("patients")
    .select("nombre, direccion, telefono, edad, ocupacion")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!p) notFound();

  return (
    <>
      <h1 className="text-2xl font-semibold text-brand">Editar paciente</h1>
      <PatientForm
        action={updatePatient.bind(null, id)}
        initial={p}
        submitLabel="Guardar cambios"
        cancelHref={`/dashboard/pacientes/${id}`}
      />
    </>
  );
}
