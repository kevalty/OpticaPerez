"use server";

import { revalidatePath } from "next/cache";
import { msg } from "@/lib/mensajes";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { LIMITE_PACIENTES, type PacienteFila } from "@/lib/pacientes";
import { insertTurno, leerTurno } from "@/lib/appointments";
import { createClient } from "@/lib/supabase/server";
import { cleanSearch, optionalUuid, patientSchema, uuid, valores, type FormState } from "@/lib/validation";

export async function createPatient(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole("recepcionista", "doctor", "administrador");

  const parsed = patientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: valores(formData) };

  // Solo recepcion/administrador dan turnos. Se valida ANTES de guardar al paciente para no dejar el registro a medias.
  const quiereTurno = formData.get("dar_turno") === "on" && (user.rol === "recepcionista" || user.rol === "administrador");
  const turno = quiereTurno ? leerTurno(formData) : null;
  if (turno && !turno.ok) return { error: turno.error, values: valores(formData) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .insert({ ...parsed.data, created_by: user.id })
    .select("id")
    .single();
  if (error || !data) {
    if (error) console.error("createPatient fallo:", error.code);
    if (error?.code === "42703" || error?.code === "PGRST204")
      return { error: msg("La base de datos no está actualizada (falta la migración 0006). Avisa al administrador."), values: valores(formData) };
    if (error?.code === "23505") return { error: msg("Ya existe un paciente registrado con ese número de documento."), values: valores(formData) };
    return { error: msg("No se pudo guardar el paciente. Inténtalo de nuevo."), values: valores(formData) };
  }

  revalidatePath("/dashboard/pacientes");
  if (turno?.ok) {
    const r = await insertTurno(supabase, user.id, data.id, optionalUuid(formData.get("optometrista_id")), turno.turno);
    revalidatePath("/dashboard/turnos");
    if (!r.ok) redirect(`/dashboard/pacientes/${data.id}?error=${encodeURIComponent(r.error)}`);
    redirect(`/dashboard/turnos?fecha=${turno.turno.fecha}`);
  }
  redirect(`/dashboard/pacientes/${data.id}`);
}

export async function updatePatient(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("recepcionista", "doctor", "administrador");
  if (!uuid.safeParse(id).success) return { error: msg("Paciente no válido."), values: valores(formData) };

  const parsed = patientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: valores(formData) };

  const supabase = await createClient();
  const { data, error } = await supabase.from("patients").update(parsed.data).eq("id", id).select("id");
  if (error || !data?.length) {
    if (error) console.error("updatePatient fallo:", error.code);
    if (error?.code === "23505") return { error: msg("Ya existe otro paciente con ese número de documento."), values: valores(formData) };
    return { error: msg("No se pudo guardar los cambios. Inténtalo de nuevo."), values: valores(formData) };
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

// Busqueda de pacientes sin poner lo escrito (cedula, nombre, celular) en la URL.
export async function buscarPacientes(texto: string): Promise<PacienteFila[]> {
  await requireRole("recepcionista", "doctor", "administrador");
  const q = cleanSearch(texto);
  const supabase = await createClient();
  let query = supabase
    .from("patients")
    .select("id, nombre, documento, telefono, edad")
    .is("deleted_at", null)
    .order("nombre", { ascending: true })
    .limit(LIMITE_PACIENTES);
  if (q) query = query.or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%,documento.ilike.%${q}%`);
  const { data, error } = await query;
  if (error) console.error("buscarPacientes fallo:", error.code);
  return (data ?? []) as PacienteFila[];
}
