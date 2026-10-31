"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation";

export type EstadoAdmin = { error?: string; ok?: boolean; nombre?: string };

// Solo el nombre. El rol, la activacion y la creacion de usuarios se hacen unicamente desde Supabase; la base
// ademas lo impide (permiso de columna), no solo esta pantalla.
export async function guardarNombreUsuario(id: string, _prev: EstadoAdmin, formData: FormData): Promise<EstadoAdmin> {
  void _prev;
  await requireRole("administrador");
  if (!uuid.safeParse(id).success) return { error: "Usuario no válido." };
  const nombre = String(formData.get("nombre") ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (nombre.length < 2) return { error: "Escribe el nombre completo.", nombre };
  if (nombre.length > 120) return { error: "El nombre es demasiado largo.", nombre };

  const { data, error } = await (await createClient()).from("users").update({ nombre }).eq("id", id).select("id");
  if (error || !data?.length) {
    if (error) console.error("guardarNombreUsuario fallo:", error.code);
    return { error: "No se pudo guardar el nombre.", nombre };
  }
  revalidatePath("/dashboard/admin");
  return { ok: true };
}
