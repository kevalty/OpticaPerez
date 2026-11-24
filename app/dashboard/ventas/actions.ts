"use server";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isISODate } from "@/lib/time";
import { uuid } from "@/lib/validation";
import { BUCKET_RECETAS, MAX_FOTO_BYTES, tipoImagen } from "@/lib/fotos";
import { recetaExternaSchema, recetaVacia, ventaSchema, type RecetaExterna } from "@/lib/ventas";
import { enviarMensajePedido } from "@/lib/whatsapp-envios";

// Errores que la base lanza a proposito (P0001 = regla de negocio, con mensaje claro en espanol).
function mensajeBD(error: { code?: string; message: string }, generico: string): string {
  if (error.code === "P0001") return error.message.replace(/(\d)\.(\d{2})\b/g, "$1,$2"); // 81.50 -> 81,50
  if (error.code === "42501") return "No tienes permiso para esta acción.";
  if (error.code === "P0002") return "No se encontró el registro.";
  if (error.code === "42883" || error.code === "PGRST202") return "Falta actualizar la base de datos (migración 0008). Avisa al administrador.";
  return generico;
}

// Sube la foto de la copia (si viene) y guarda la receta externa en la orden. Devuelve un mensaje de error o null.
async function guardarRecetaExterna(supabase: SupabaseClient, ordenId: string, rx: RecetaExterna, archivo: FormDataEntryValue | null): Promise<string | null> {
  let path: string | null = null;
  if (archivo instanceof File && archivo.size > 0) {
    if (archivo.size > MAX_FOTO_BYTES) return "La foto de la receta es demasiado grande.";
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    const t = tipoImagen(bytes);
    if (!t) return "La foto de la receta debe ser JPG, PNG o WebP.";
    path = `${ordenId}/${randomUUID().replaceAll("-", "")}.${t.ext}`;
    const up = await supabase.storage.from(BUCKET_RECETAS).upload(path, bytes, { contentType: t.mime, upsert: false });
    if (up.error) {
      console.error("subir receta fallo:", up.error.name);
      return "No se pudo subir la foto de la receta.";
    }
  }
  if (recetaVacia(rx) && !path) return "La receta está vacía.";
  const { error } = await supabase.rpc("guardar_receta_externa", { p_orden: ordenId, p_datos: rx, p_foto: path });
  if (error) {
    console.error("guardar receta externa fallo:", error.code);
    if (path) await supabase.storage.from(BUCKET_RECETAS).remove([path]);
    return "No se pudo guardar la receta.";
  }
  return null;
}

// La pantalla manda un FormData: "datos" (JSON de la venta), "receta" (JSON de la receta externa, opcional) y "receta_foto" (imagen, opcional).
export async function crearVenta(formData: FormData): Promise<{ error: string }> {
  await requireRole("recepcionista", "administrador");
  let input: unknown = null;
  let recetaIn: unknown = null;
  try {
    input = JSON.parse(String(formData.get("datos") ?? "null"));
    const r = formData.get("receta");
    recetaIn = typeof r === "string" && r !== "" ? JSON.parse(r) : null;
  } catch {
    return { error: "Los datos de la venta no son válidos." };
  }
  const parsed = ventaSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos de la venta." };
  const v = parsed.data;
  if (v.orden?.fecha_entrega && !isISODate(v.orden.fecha_entrega)) return { error: "La fecha de entrega no es válida." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_venta", { p: v });
  if (error || !data) {
    if (error) console.error("crearVenta fallo:", error.code);
    return { error: error ? mensajeBD(error, "No se pudo registrar la venta. Inténtalo de nuevo.") : "No se pudo registrar la venta." };
  }
  const creada = data as { sale_id: string; order_id: string | null };
  // Receta externa (copia de receta del cliente): se guarda en la orden, sin crear ficha medica.
  let avisoReceta = "";
  if (creada.order_id && recetaIn) {
    const rx = recetaExternaSchema.safeParse(recetaIn);
    const foto = formData.get("receta_foto");
    const err = rx.success ? await guardarRecetaExterna(supabase, creada.order_id, rx.data, foto) : "La receta no es válida.";
    if (err) avisoReceta = "&receta=no";
  }
  revalidatePath("/dashboard/ventas");
  // Recibo automatico por WhatsApp ("enviado a hacer"); si no se puede, queda el boton manual en la venta.
  let wa = "";
  if (creada.order_id) {
    const user = await requireRole("recepcionista", "administrador");
    const r = await enviarMensajePedido(supabase, user.id, creada.order_id, "pedido_recibo", true);
    wa = r.ok ? "&wa=ok" : r.motivo === "permiso" ? "&wa=permiso" : "&wa=no";
  }
  redirect(`/dashboard/ventas/${creada.sale_id}?ok=venta${wa}${avisoReceta}`);
}

export type EstadoForm = { error?: string; ok?: boolean };

export async function registrarAbono(ventaId: string, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  await requireRole("recepcionista", "administrador");
  if (!uuid.safeParse(ventaId).success) return { error: "Venta no válida." };

  const monto = Number(String(formData.get("monto") ?? "").replace(",", "."));
  const metodo = String(formData.get("metodo") ?? "");
  const nota = String(formData.get("nota") ?? "").slice(0, 200);
  if (!Number.isFinite(monto) || monto <= 0) return { error: "Escribe un monto mayor a cero." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_abono", { p_venta: ventaId, p_monto: monto, p_metodo: metodo, p_nota: nota || null });
  if (error) {
    console.error("registrarAbono fallo:", error.code);
    return { error: mensajeBD(error, "No se pudo registrar el pago.") };
  }
  revalidatePath(`/dashboard/ventas/${ventaId}`);
  revalidatePath("/dashboard/ventas");
  return { ok: true };
}

export async function anularVenta(ventaId: string, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  await requireRole("administrador");
  if (!uuid.safeParse(ventaId).success) return { error: "Venta no válida." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_venta", { p_venta: ventaId, p_motivo: String(formData.get("motivo") ?? "") });
  if (error) {
    console.error("anularVenta fallo:", error.code);
    return { error: mensajeBD(error, "No se pudo anular la venta.") };
  }
  revalidatePath(`/dashboard/ventas/${ventaId}`);
  revalidatePath("/dashboard/ventas");
  return { ok: true };
}
