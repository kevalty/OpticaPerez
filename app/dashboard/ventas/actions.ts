"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isISODate } from "@/lib/time";
import { uuid } from "@/lib/validation";
import { ventaSchema } from "@/lib/ventas";

// Errores que la base lanza a proposito (P0001 = regla de negocio, con mensaje claro en espanol).
function mensajeBD(error: { code?: string; message: string }, generico: string): string {
  if (error.code === "P0001") return error.message;
  if (error.code === "42501") return "No tienes permiso para esta acción.";
  if (error.code === "P0002") return "No se encontró el registro.";
  if (error.code === "42883" || error.code === "PGRST202") return "Falta actualizar la base de datos (migración 0008). Avisa al administrador.";
  return generico;
}

export async function crearVenta(input: unknown): Promise<{ error: string }> {
  await requireRole("recepcionista", "administrador");
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
  revalidatePath("/dashboard/ventas");
  redirect(`/dashboard/ventas/${(data as { sale_id: string }).sale_id}?ok=venta`);
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
