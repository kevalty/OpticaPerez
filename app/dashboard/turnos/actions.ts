"use server";

import { revalidatePath } from "next/cache";
import { msg } from "@/lib/mensajes";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { insertTurno, leerTurno } from "@/lib/appointments";
import { buildFichaPayload, fichaSchema, fichaVacia } from "@/lib/ficha";
import { leerRecetario } from "@/lib/recetario";
import { createClient } from "@/lib/supabase/server";
import { isISODate, todayISO } from "@/lib/time";
import { optionalUuid, uuid, type FormState } from "@/lib/validation";

const AGENDA = "/dashboard/turnos";

// URL de la agenda del dia indicado, con parametros extra (error, consulta, ok...).
function volver(fecha: unknown, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams();
  if (isISODate(fecha)) p.set("fecha", fecha);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  const qs = p.toString();
  return qs ? `${AGENDA}?${qs}` : AGENDA;
}

function idDe(formData: FormData): string | null {
  const id = formData.get("id");
  return typeof id === "string" && uuid.safeParse(id).success ? id : null;
}

// ---------- Recepcion ----------

export async function darTurno(formData: FormData): Promise<void> {
  const user = await requireRole("recepcionista", "administrador");
  const patientId = formData.get("patient_id");
  if (typeof patientId !== "string" || !uuid.safeParse(patientId).success) redirect(`${AGENDA}/nuevo`);

  const datos = leerTurno(formData);
  if (!datos.ok) redirect(`${AGENDA}/nuevo?error=${encodeURIComponent(datos.error)}`);

  const supabase = await createClient();
  const r = await insertTurno(supabase, user.id, patientId, optionalUuid(formData.get("optometrista_id")), datos.turno);
  if (!r.ok) redirect(`${AGENDA}/nuevo?error=${encodeURIComponent(r.error)}`);

  revalidatePath(AGENDA);
  redirect(volver(datos.turno.fecha));
}

// El paciente agendado llego al local: pasa a la lista de espera. Solo el dia del turno.
export async function llegoPaciente(formData: FormData): Promise<void> {
  await requireRole("recepcionista", "administrador");
  const id = idDe(formData);
  const fecha = formData.get("fecha");
  if (!id) redirect(volver(fecha));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .update({ estado: "en_espera" })
    .eq("id", id)
    .eq("estado", "agendado")
    .lte("fecha", todayISO())
    .select("id");
  if (error || !data?.length) {
    if (error) console.error("llegoPaciente fallo:", error.code);
    redirect(volver(fecha, { error: msg("Solo se puede registrar la llegada el día del turno.") }));
  }
  revalidatePath(AGENDA);
  redirect(volver(fecha));
}

export async function cancelarTurno(formData: FormData): Promise<void> {
  await requireRole("recepcionista", "administrador");
  const id = idDe(formData);
  const fecha = formData.get("fecha");
  if (!id) redirect(volver(fecha));

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancelar_turno", { p_turno: id });
  if (error) {
    console.error("cancelarTurno fallo:", error.code);
    redirect(volver(fecha, { error: msg("No se pudo cancelar el turno.") }));
  }
  revalidatePath(AGENDA);
  redirect(volver(fecha));
}

// La recepcionista ya entrego las indicaciones / impresiones: el turno se cierra.
export async function finalizarTurno(formData: FormData): Promise<void> {
  await requireRole("recepcionista", "administrador");
  const id = idDe(formData);
  const fecha = formData.get("fecha");
  if (!id) redirect(volver(fecha));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .update({ estado: "finalizado" })
    .eq("id", id)
    .eq("estado", "atendido")
    .select("id");
  if (error || !data?.length) {
    if (error) console.error("finalizarTurno fallo:", error.code);
    redirect(volver(fecha, { error: msg("No se pudo finalizar el turno.") }));
  }
  revalidatePath(AGENDA);
  redirect(volver(fecha));
}

// ---------- Doctor ----------

// "En consultorio": solo el doctor (o el administrador). Abre la ficha del paciente.
export async function iniciarConsulta(formData: FormData): Promise<void> {
  const user = await requireRole("doctor", "administrador");
  const id = idDe(formData);
  const fecha = formData.get("fecha");
  if (!id) redirect(volver(fecha));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .update({ estado: "en_consulta", optometrista_id: user.id })
    .eq("id", id)
    .eq("estado", "en_espera")
    .select("id");
  if (error || !data?.length) {
    if (error) console.error("iniciarConsulta fallo:", error.code);
    // Si ya estaba en consulta con este mismo usuario, simplemente se vuelve a abrir.
    const { data: ya } = await supabase
      .from("appointments")
      .select("id")
      .eq("id", id)
      .eq("estado", "en_consulta")
      .eq("optometrista_id", user.id)
      .maybeSingle();
    if (!ya) redirect(volver(fecha, { error: msg("Este turno ya no está disponible para consulta.") }));
  }
  revalidatePath(AGENDA);
  redirect(volver(fecha, { consulta: id }));
}

// Guarda la ficha completa y marca el turno como atendido (todo o nada, dentro de la base de datos).
export async function guardarFicha(turnoId: string, fecha: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("doctor", "administrador");
  if (!uuid.safeParse(turnoId).success) return { error: msg("Turno no válido.") };

  const parsed = fichaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const rec = leerRecetario(formData);
  if (!rec.ok) return { error: msg(rec.error) };

  const payload = { ...buildFichaPayload(parsed.data), recetario: rec.value };
  if (fichaVacia(payload)) return { error: msg("La ficha está vacía. Anota al menos un dato antes de guardar.") };

  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_ficha", { p_turno: turnoId, p_ficha: payload });
  if (error) {
    console.error("guardarFicha fallo:", error.code);
    if (error.code === "P0001") return { error: msg("Este turno ya no está en consulta (¿ya se guardó la ficha?).") };
    if (error.code === "42501") return { error: msg("No tienes permiso para guardar esta ficha.") };
    return { error: msg("No se pudo guardar la ficha. Revisa los datos e inténtalo de nuevo.") };
  }

  revalidatePath(AGENDA);
  redirect(volver(fecha, { ok: "ficha" }));
}
