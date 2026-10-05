"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { insertTurno } from "@/lib/appointments";
import { createClient } from "@/lib/supabase/server";
import { isISODate } from "@/lib/time";
import { appointmentStatus, optionalUuid, uuid } from "@/lib/validation";

// Estados que cada rol puede poner. La recepcionista pasa al paciente al consultorio;
// solo doctor/administrador cierran la consulta.
const ALLOWED: Record<string, readonly string[]> = {
  recepcionista: ["en_consulta"],
  doctor: ["en_consulta", "atendido"],
  administrador: ["en_espera", "en_consulta", "atendido"],
};

export async function darTurno(formData: FormData): Promise<void> {
  const user = await requireRole("recepcionista", "administrador");
  const patientId = formData.get("patient_id");
  if (typeof patientId !== "string" || !uuid.safeParse(patientId).success) redirect("/dashboard/turnos/nuevo");

  const supabase = await createClient();
  const ok = await insertTurno(supabase, user.id, patientId, optionalUuid(formData.get("optometrista_id")));
  if (!ok) redirect("/dashboard/turnos/nuevo?error=1");

  revalidatePath("/dashboard/turnos");
  redirect("/dashboard/turnos");
}

export async function cambiarEstado(formData: FormData): Promise<void> {
  const user = await requireRole("recepcionista", "doctor", "administrador");
  const id = formData.get("id");
  const estado = appointmentStatus.safeParse(formData.get("estado"));
  const fechaRaw = formData.get("fecha");
  const back = `/dashboard/turnos${isISODate(fechaRaw) ? `?fecha=${fechaRaw}` : ""}`;
  const sep = back.includes("?") ? "&" : "?";

  if (typeof id !== "string" || !uuid.safeParse(id).success || !estado.success) redirect(back);
  if (!ALLOWED[user.rol]?.includes(estado.data)) redirect(`${back}${sep}error=1`);

  const cambios: { estado: string; optometrista_id?: string } = { estado: estado.data };
  // Un doctor que inicia la consulta queda como optometrista responsable del turno.
  if (user.rol === "doctor" && estado.data === "en_consulta") cambios.optometrista_id = user.id;

  const supabase = await createClient();
  const { data, error } = await supabase.from("appointments").update(cambios).eq("id", id).select("id");
  if (error || !data?.length) {
    if (error) console.error("cambiarEstado fallo:", error.code);
    redirect(`${back}${sep}error=1`);
  }

  revalidatePath("/dashboard/turnos");
  redirect(back);
}
