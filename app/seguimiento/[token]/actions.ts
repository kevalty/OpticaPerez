"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type EstadoConfirmacion = { error?: string; ok?: boolean };

// El cliente confirma (sin cuenta) con el token de su pedido: recibio en buen estado y acepta la garantia.
// La regla vive en la base (confirmar_entrega): solo si el pedido esta entregado y una sola vez.
export async function confirmarEntrega(token: string, via: string, _prev: EstadoConfirmacion, formData: FormData): Promise<EstadoConfirmacion> {
  void _prev;
  if (!/^[0-9a-f]{64}$/.test(token)) return { error: "El enlace no es válido." };
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (nombre.length < 2) return { error: "Escribe tu nombre completo." };
  if (formData.get("buen_estado") !== "on" || formData.get("garantia") !== "on") return { error: "Marca las dos casillas para confirmar." };

  const { error } = await (await createClient()).rpc("confirmar_entrega", {
    p_token: token,
    p_nombre: nombre.slice(0, 120),
    p_buen_estado: true,
    p_garantia: true,
    p_via: via === "ipad" ? "ipad" : "whatsapp",
  });
  if (error) {
    console.error("confirmarEntrega fallo:", error.code);
    if (error.code === "P0001") return { error: error.message };
    return { error: "No se pudo guardar tu confirmación. Inténtalo de nuevo." };
  }
  revalidatePath(`/seguimiento/${token}`);
  return { ok: true };
}
