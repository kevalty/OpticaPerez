"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { insertTurno } from "@/lib/appointments";
import { createClient } from "@/lib/supabase/server";
import { optionalUuid, patientSchema, uuid, type FormState } from "@/lib/validation";

export async function createPatient(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole("recepcionista", "doctor", "administrador");

  const parsed = patientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .insert({ ...parsed.data, created_by: user.id })
    .select("id")
    .single();
  if (error || !data) {
    if (error) console.error("createPatient fallo:", error.code);
    return { error: "No se pudo guardar el paciente. Inténtalo de nuevo." };
  }

  // Registro en mostrador + turno directo (solo recepcion/administrador pueden dar turnos).
  if (formData.get("dar_turno") === "on" && (user.rol === "recepcionista" || user.rol === "administrador")) {
    const ok = await insertTurno(supabase, user.id, data.id, optionalUuid(formData.get("optometrista_id")));
    if (ok) {
      revalidatePath("/dashboard/turnos");
      redirect("/dashboard/turnos");
    }
  }

  revalidatePath("/dashboard/pacientes");
  redirect(`/dashboard/pacientes/${data.id}`);
}

export async function updatePatient(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("recepcionista", "doctor", "administrador");
  if (!uuid.safeParse(id).success) return { error: "Paciente no válido." };

  const parsed = patientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.from("patients").update(parsed.data).eq("id", id).select("id");
  if (error || !data?.length) {
    if (error) console.error("updatePatient fallo:", error.code);
    return { error: "No se pudo guardar los cambios. Inténtalo de nuevo." };
  }

  revalidatePath("/dashboard/pacientes");
  revalidatePath(`/dashboard/pacientes/${id}`);
  redirect(`/dashboard/pacientes/${id}`);
}

// Soft delete: el paciente no se borra, solo se archiva (trazabilidad clinica). Solo administrador.
export async function archivePatient(formData: FormData): Promise<void> {
  await requireRole("administrador");
  const id = formData.get("id");
  if (typeof id !== "string" || !uuid.safeParse(id).success) redirect("/dashboard/pacientes");

  const supabase = await createClient();
  const { error } = await supabase.from("patients").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) {
    console.error("archivePatient fallo:", error.code);
    redirect(`/dashboard/pacientes/${id}?error=1`);
  }

  revalidatePath("/dashboard/pacientes");
  redirect("/dashboard/pacientes");
}
