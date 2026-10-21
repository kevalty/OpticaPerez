"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isISODate } from "@/lib/time";
import { uuid } from "@/lib/validation";
import { ESTADOS_PEDIDO } from "@/lib/pedidos";
import { enviarMensajePedido } from "@/lib/whatsapp-envios";

export type EstadoPedidoForm = { error?: string; ok?: boolean; aviso?: string };

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
  if (estado === "listo_para_recibir") {
    const r = await enviarMensajePedido(supabase, user.id, ordenId, "pedido_listo", true);
    aviso = r.ok ? "Se avisó al cliente por WhatsApp." : `No se pudo avisar por WhatsApp: ${r.error} Usa el botón de aviso.`;
  }
  revalidatePath(`/dashboard/pedidos/${ordenId}`);
  revalidatePath("/dashboard/pedidos");
  revalidatePath("/dashboard/whatsapp");
  return { ok: true, aviso };
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
