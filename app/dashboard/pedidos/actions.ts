"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isISODate } from "@/lib/time";
import { uuid } from "@/lib/validation";
import { ESTADOS_PEDIDO } from "@/lib/pedidos";
import { BUCKET_ENTREGAS, MAX_FOTO_BYTES, tipoImagen } from "@/lib/fotos";
import { enviarMensajePedido } from "@/lib/whatsapp-envios";

export type EstadoPedidoForm = { error?: string; ok?: boolean; aviso?: string; avisoFallo?: boolean };

function mensajeBD(error: { code?: string; message: string }, generico: string): string {
  if (error.code === "P0001") return error.message;
  if (error.code === "42501") return "No tienes permiso para esta acción.";
  if (error.code === "P0002") return "No se encontró el pedido.";
  if (error.code === "42883" || error.code === "PGRST202" || error.code === "22P02")
    return "Falta actualizar la base de datos (migraciones 0011 y 0012). Avisa al administrador.";
  return generico;
}

export async function cambiarEstadoPedido(ordenId: string, estado: string, _prev: EstadoPedidoForm): Promise<EstadoPedidoForm> {
  void _prev;
  const user = await requireRole("recepcionista", "administrador");
  if (!uuid.safeParse(ordenId).success || !ESTADOS_PEDIDO.some((e) => e.id === estado)) return { error: "Pedido no válido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_estado_pedido", { p_orden: ordenId, p_estado: estado });
  if (error) {
    console.error("cambiarEstadoPedido fallo:", error.code);
    return { error: mensajeBD(error, "No se pudo cambiar el estado. Inténtalo de nuevo.") };
  }
  // Aviso automatico "listo para recibir"; si falla, el estado ya cambio y queda el aviso manual.
  let aviso: string | undefined;
  let avisoFallo = false;
  if (estado === "listo_para_recibir") {
    const r = await enviarMensajePedido(supabase, user.id, ordenId, "pedido_listo", true);
    avisoFallo = !r.ok;
    aviso = !r.ok
      ? `No se pudo avisar por WhatsApp: ${r.error} Usa el botón de aviso.`
      : r.yaEnviado
        ? "El cliente ya había recibido este aviso; no se envió otro."
        : "Se avisó al cliente por WhatsApp.";
  }
  // Al entregar: mensaje con el enlace para ver la foto de la entrega y confirmar la recepcion y la garantia.
  if (estado === "entregado") {
    const r = await enviarMensajePedido(supabase, user.id, ordenId, "entrega", true);
    avisoFallo = !r.ok;
    aviso = !r.ok
      ? `No se pudo enviar la confirmación por WhatsApp: ${r.error} El cliente puede confirmar en el iPad de la óptica.`
      : r.yaEnviado
        ? "El cliente ya había recibido este aviso; no se envió otro."
        : "Se envió al cliente el enlace para confirmar su entrega y ver su garantía.";
  }
  revalidatePath(`/dashboard/pedidos/${ordenId}`);
  revalidatePath("/dashboard/pedidos");
  revalidatePath("/dashboard/whatsapp");
  return { ok: true, aviso, avisoFallo };
}

export async function guardarEntrega(ordenId: string, _prev: EstadoPedidoForm, formData: FormData): Promise<EstadoPedidoForm> {
  await requireRole("recepcionista", "administrador");
  if (!uuid.safeParse(ordenId).success) return { error: "Pedido no válido." };
  const f = String(formData.get("fecha_entrega") ?? "").trim();
  if (f !== "" && !isISODate(f)) return { error: "La fecha no es válida." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("orders").update({ fecha_entrega: f === "" ? null : f }).eq("id", ordenId).select("id");
  if (error || !data?.length) {
    if (error) console.error("guardarEntrega fallo:", error.code);
    return { error: "No se pudo guardar la fecha de entrega." };
  }
  revalidatePath(`/dashboard/pedidos/${ordenId}`);
  revalidatePath("/dashboard/pedidos");
  return { ok: true };
}

// Foto de como se entrega el pedido: queda en el pedido y el cliente la ve en su enlace de seguimiento.
export async function subirFotoEntrega(ordenId: string, _prev: EstadoPedidoForm, formData: FormData): Promise<EstadoPedidoForm> {
  void _prev;
  const user = await requireRole("recepcionista", "administrador");
  if (!uuid.safeParse(ordenId).success) return { error: "Pedido no válido." };
  const archivo = formData.get("foto");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Toma o elige una foto primero." };
  if (archivo.size > MAX_FOTO_BYTES) return { error: "La foto es demasiado grande (máximo 3 MB)." };
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const t = tipoImagen(bytes);
  if (!t) return { error: "La foto debe ser JPG, PNG o WebP." };

  const supabase = await createClient();
  const path = `${ordenId}/${randomUUID().replaceAll("-", "")}.${t.ext}`;
  const up = await supabase.storage.from(BUCKET_ENTREGAS).upload(path, bytes, { contentType: t.mime, upsert: false });
  if (up.error) {
    console.error("subir foto entrega fallo:", up.error.name);
    return { error: "No se pudo subir la foto. Revisa la conexión e inténtalo de nuevo." };
  }
  const { error } = await supabase.from("order_fotos").insert({ order_id: ordenId, path, user_id: user.id });
  if (error) {
    console.error("guardar foto entrega fallo:", error.code);
    await supabase.storage.from(BUCKET_ENTREGAS).remove([path]);
    return { error: error.code === "42P01" ? "Falta actualizar la base de datos (migración 0020). Avisa al administrador." : "No se pudo guardar la foto." };
  }
  revalidatePath(`/dashboard/pedidos/${ordenId}`);
  return { ok: true };
}
