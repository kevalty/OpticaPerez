import type { SupabaseClient } from "@supabase/supabase-js";
import { fechaCorta } from "@/lib/pedidos";
import { formatDateLong } from "@/lib/time";
import { normalizarTelefono } from "@/lib/whatsapp";
import { enviarPlantillaWA, whatsappConfigurado } from "@/lib/whatsapp-api";

export type TipoWA = "pedido_recibo" | "pedido_listo" | "control_adaptacion" | "control_anual" | "turno" | "saldo";
export const TIPOS_WA: { id: TipoWA; label: string }[] = [
  { id: "pedido_recibo", label: "Recibo del pedido" },
  { id: "pedido_listo", label: "Pedido listo" },
  { id: "turno", label: "Turno de mañana" },
  { id: "saldo", label: "Saldo pendiente" },
  { id: "control_adaptacion", label: "Control de adaptación" },
  { id: "control_anual", label: "Control anual" },
];
export const tipoWALabel = (id: string) => TIPOS_WA.find((t) => t.id === id)?.label ?? id;

export type Refs = { patient_id?: string | null; order_id?: string | null; sale_id?: string | null; appointment_id?: string | null };
export type ResultadoEnvio = { ok: boolean; error?: string; yaEnviado?: boolean };

const dinero = (n: number) => `$${n.toFixed(2).replace(".", ",")}`;
const pad = (n: number) => String(n).padStart(6, "0");

// Envia una plantilla y deja constancia en el historial (whatsapp_envios). No envia si no hay configuracion,
// si la plantilla no esta activa o si el paciente no autorizo WhatsApp.
export async function enviarWA(
  supabase: SupabaseClient,
  usuarioId: string,
  o: { tipo: TipoWA; telefono: string | null; cuerpo: string[]; urlSufijo?: string; refs: Refs },
): Promise<ResultadoEnvio> {
  if (!whatsappConfigurado()) return { ok: false, error: "WhatsApp no está configurado en el sistema (modo manual)." };
  const { data: pl, error: ePl } = await supabase.from("whatsapp_plantillas").select("nombre, idioma, activa").eq("tipo", o.tipo).maybeSingle();
  if (ePl || !pl) return { ok: false, error: "Falta actualizar la base de datos (migración 0013). Avisa al administrador." };
  if (!pl.activa) return { ok: false, error: "La plantilla de este mensaje todavía no está activa. Créala en Meta y actívala en WhatsApp → Plantillas." };

  if (o.refs.patient_id) {
    const { data: p } = await supabase.from("patients").select("acepta_whatsapp").eq("id", o.refs.patient_id).maybeSingle();
    if (p && p.acepta_whatsapp === false) return { ok: false, error: "El paciente no autorizó recibir mensajes por WhatsApp." };
  }

  const r = await enviarPlantillaWA({ telefono: o.telefono, plantilla: pl.nombre, idioma: pl.idioma, cuerpo: o.cuerpo, urlSufijo: o.urlSufijo });
  await supabase.from("whatsapp_envios").insert({
    tipo: o.tipo,
    patient_id: o.refs.patient_id ?? null,
    order_id: o.refs.order_id ?? null,
    sale_id: o.refs.sale_id ?? null,
    appointment_id: o.refs.appointment_id ?? null,
    destino: (normalizarTelefono(o.telefono) ?? String(o.telefono ?? "")).slice(0, 20),
    plantilla: pl.nombre,
    estado: r.ok ? "enviado" : "fallido",
    wa_message_id: r.ok ? r.id : null,
    error: r.ok ? null : r.error.slice(0, 500),
    enviado_por: usuarioId,
  });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

type DetallePedido = { token: string | null; telefono: string | null; paciente: string; patient_id: string; numero: number; sale_id: string; saldo: number | null };

// Mensajes del pedido: recibo al cerrar la venta ("enviado a hacer") y aviso de "listo para recibir".
export async function enviarMensajePedido(
  supabase: SupabaseClient,
  usuarioId: string,
  ordenId: string,
  tipo: "pedido_recibo" | "pedido_listo",
  evitarDuplicado: boolean,
): Promise<ResultadoEnvio> {
  const { data } = await supabase.rpc("pedido_detalle", { p_orden: ordenId });
  const d = data as DetallePedido | null;
  if (!d?.token) return { ok: false, error: "No se encontró el pedido." };

  if (evitarDuplicado) {
    const { data: ya } = await supabase.from("whatsapp_envios").select("id").eq("order_id", ordenId).eq("tipo", tipo).eq("estado", "enviado").limit(1);
    if (ya && ya.length > 0) return { ok: true, yaEnviado: true };
  }
  const nombre = d.paciente.trim().split(" ")[0];
  const cuerpo = tipo === "pedido_recibo" ? [nombre, pad(d.numero)] : [nombre, pad(d.numero), dinero(d.saldo ?? 0)];
  return enviarWA(supabase, usuarioId, {
    tipo,
    telefono: d.telefono,
    cuerpo,
    urlSufijo: d.token,
    refs: { patient_id: d.patient_id, order_id: ordenId, sale_id: d.sale_id },
  });
}

export type Pendiente = {
  tipo: Exclude<TipoWA, "pedido_recibo" | "pedido_listo">;
  patient_id: string;
  paciente: string;
  telefono: string | null;
  ref_id: string;
  datos: Record<string, string | number>;
};

// Un recordatorio de la lista de pendientes. Se vuelve a calcular en el servidor: no se confia en lo que manda el navegador.
export async function enviarRecordatorio(
  supabase: SupabaseClient,
  usuarioId: string,
  item: { tipo: string; patient_id: string; ref_id: string },
): Promise<ResultadoEnvio> {
  const { data } = await supabase.rpc("recordatorios_pendientes");
  const p = ((data ?? []) as Pendiente[]).find((x) => x.tipo === item.tipo && x.patient_id === item.patient_id && x.ref_id === item.ref_id);
  if (!p) return { ok: false, error: "Este recordatorio ya no está pendiente (quizás ya se envió)." };

  const nombre = p.paciente.trim().split(" ")[0];
  const d = p.datos;
  let cuerpo: string[] = [];
  const refs: Refs = { patient_id: p.patient_id };
  if (p.tipo === "turno") {
    cuerpo = [nombre, formatDateLong(String(d.fecha)), String(d.hora || "la hora acordada")];
    refs.appointment_id = p.ref_id;
  } else if (p.tipo === "saldo") {
    cuerpo = [nombre, pad(Number(d.numero)), dinero(Number(d.saldo))];
    refs.sale_id = p.ref_id;
  } else if (p.tipo === "control_adaptacion") {
    cuerpo = [nombre];
    refs.order_id = p.ref_id;
  } else {
    cuerpo = [nombre, fechaCorta(String(d.ultima))];
  }
  return enviarWA(supabase, usuarioId, { tipo: p.tipo, telefono: p.telefono, cuerpo, refs });
}
