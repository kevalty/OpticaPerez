"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation";
import { enviarMensajePedido, enviarRecordatorio as enviarRec, TIPOS_WA } from "@/lib/whatsapp-envios";
import { enviarPlantillaWA, whatsappConfigurado } from "@/lib/whatsapp-api";

export type EstadoWA = { error?: string; ok?: boolean };

// Boton "Enviar por WhatsApp" de un pedido (recibo o listo para recibir).
export async function enviarPedidoWA(ordenId: string, tipo: "pedido_recibo" | "pedido_listo", _prev: EstadoWA): Promise<EstadoWA> {
  void _prev;
  const user = await requireRole("recepcionista", "administrador");
  if (!uuid.safeParse(ordenId).success) return { error: "Pedido no válido." };
  const r = await enviarMensajePedido(await createClient(), user.id, ordenId, tipo, false);
  revalidatePath(`/dashboard/pedidos/${ordenId}`);
  revalidatePath("/dashboard/whatsapp");
  return r.ok ? { ok: true } : { error: r.error };
}

export async function enviarRecordatorio(item: { tipo: string; patient_id: string; ref_id: string }): Promise<EstadoWA> {
  const user = await requireRole("recepcionista", "administrador");
  if (!TIPOS_WA.some((t) => t.id === item.tipo) || !uuid.safeParse(item.patient_id).success || !uuid.safeParse(item.ref_id).success) {
    return { error: "Recordatorio no válido." };
  }
  const r = await enviarRec(await createClient(), user.id, item);
  revalidatePath("/dashboard/whatsapp");
  return r.ok ? { ok: true } : { error: r.error };
}

// Administrador: nombre exacto de la plantilla en Meta, idioma y si esta activa.
export async function guardarPlantilla(tipo: string, _prev: EstadoWA, formData: FormData): Promise<EstadoWA> {
  await requireRole("administrador");
  if (!TIPOS_WA.some((t) => t.id === tipo)) return { error: "Plantilla no válida." };
  const nombre = String(formData.get("nombre") ?? "").trim();
  const idioma = String(formData.get("idioma") ?? "es").trim();
  if (!/^[a-z0-9_]{1,512}$/.test(nombre)) return { error: "El nombre de la plantilla solo lleva minúsculas, números y guion bajo (igual que en Meta)." };
  if (!/^[a-z]{2}(_[A-Z]{2})?$/.test(idioma)) return { error: "Idioma no válido (por ejemplo es o es_MX)." };
  const { data, error } = await (await createClient())
    .from("whatsapp_plantillas")
    .update({ nombre, idioma, activa: formData.get("activa") === "on", updated_at: new Date().toISOString() })
    .eq("tipo", tipo)
    .select("tipo");
  if (error || !data?.length) {
    if (error) console.error("guardarPlantilla fallo:", error.code);
    return { error: "No se pudo guardar la plantilla." };
  }
  revalidatePath("/dashboard/whatsapp");
  return { ok: true };
}

// Administrador: manda la plantilla de ejemplo "hello_world" de Meta a un celular, para comprobar que las claves funcionan.
export async function probarWhatsApp(_prev: EstadoWA, formData: FormData): Promise<EstadoWA> {
  await requireRole("administrador");
  if (!whatsappConfigurado()) return { error: "Faltan las variables WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID en Vercel." };
  const r = await enviarPlantillaWA({ telefono: String(formData.get("telefono") ?? ""), plantilla: "hello_world", idioma: "en_US", cuerpo: [] });
  return r.ok ? { ok: true } : { error: r.error };
}
