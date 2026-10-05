import type { SupabaseClient } from "@supabase/supabase-js";
import { msg } from "@/lib/mensajes";
import { isISODate, nowTime, shiftDate, todayISO } from "@/lib/time";

export type TurnoDatos = { fecha: string; hora: string; estado: "agendado" | "en_espera" };

// Lee fecha y hora del formulario de "dar turno".
//  - Sin hora y fecha de hoy  => el paciente esta en el local: entra "en espera" ahora mismo.
//  - Con hora (hoy o despues) => turno "agendado"; la recepcionista lo marca "llego" cuando venga.
export function leerTurno(formData: FormData): { ok: true; turno: TurnoDatos } | { ok: false; error: string } {
  const hoy = todayISO();
  const fechaRaw = formData.get("fecha");
  const horaRaw = typeof formData.get("hora") === "string" ? (formData.get("hora") as string).trim() : "";

  if (fechaRaw && fechaRaw !== "" && !isISODate(fechaRaw)) return { ok: false, error: msg("La fecha del turno no es válida.") };
  const fecha = typeof fechaRaw === "string" && fechaRaw !== "" ? fechaRaw : hoy;
  if (fecha < hoy) return { ok: false, error: msg("La fecha del turno no puede ser anterior a hoy.") };
  if (fecha > shiftDate(hoy, 366)) return { ok: false, error: msg("Solo se puede agendar hasta con un año de anticipación.") };

  if (horaRaw !== "" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(horaRaw)) return { ok: false, error: msg("La hora del turno no es válida.") };

  if (horaRaw === "") {
    if (fecha !== hoy) return { ok: false, error: msg("Indica la hora del turno para agendarlo en otra fecha.") };
    return { ok: true, turno: { fecha, hora: nowTime(), estado: "en_espera" } };
  }
  return { ok: true, turno: { fecha, hora: horaRaw, estado: "agendado" } };
}

export type TurnoResultado = { ok: true } | { ok: false; error: string };

// Crea el turno. Devuelve un mensaje claro si el paciente ya tiene uno ese dia.
export async function insertTurno(
  supabase: SupabaseClient,
  recepcionistaId: string,
  patientId: string,
  optometristaId: string | null,
  turno: TurnoDatos,
): Promise<TurnoResultado> {
  const { error } = await supabase.from("appointments").insert({
    patient_id: patientId,
    fecha: turno.fecha,
    hora: turno.hora,
    estado: turno.estado,
    recepcionista_id: recepcionistaId,
    optometrista_id: optometristaId,
  });
  if (!error) return { ok: true };
  // Solo el codigo de error: nunca registrar datos de pacientes en logs.
  console.error("insertTurno fallo:", error.code);
  if (error.code === "23505") return { ok: false, error: msg("Este paciente ya tiene un turno activo en esa fecha.") };
  return { ok: false, error: msg("No se pudo dar el turno. Inténtalo de nuevo.") };
}
