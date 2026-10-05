import type { SupabaseClient } from "@supabase/supabase-js";
import { nowTime, todayISO } from "@/lib/time";

// Crea un turno para hoy en estado "en espera". Devuelve false si la base de datos lo rechaza.
export async function insertTurno(
  supabase: SupabaseClient,
  recepcionistaId: string,
  patientId: string,
  optometristaId: string | null,
): Promise<boolean> {
  const { error } = await supabase.from("appointments").insert({
    patient_id: patientId,
    fecha: todayISO(),
    hora: nowTime(),
    estado: "en_espera",
    recepcionista_id: recepcionistaId,
    optometrista_id: optometristaId,
  });
  // Solo el codigo de error: nunca registrar datos de pacientes en logs.
  if (error) console.error("insertTurno fallo:", error.code);
  return !error;
}
