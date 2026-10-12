"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { msg } from "@/lib/mensajes";
import { createClient } from "@/lib/supabase/server";
import { uuid, valores, type FormState } from "@/lib/validation";
import { productoSchema } from "@/lib/ventas";

const LISTA = "/dashboard/productos";

function errorProducto(code: string | undefined): string {
  if (code === "23505") return "Ya existe un producto con ese código.";
  if (code === "22P02") return "Falta actualizar la base de datos (migración 0009, tipo servicio). Avisa al administrador.";
  if (code === "42703" || code === "PGRST204") return "Falta actualizar la base de datos (migración 0008). Avisa al administrador.";
  return "No se pudo guardar el producto. Inténtalo de nuevo.";
}

export async function crearProducto(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("administrador");
  const parsed = productoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: valores(formData) };
  const { stock, ...datos } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.from("products").insert({ ...datos, stock: 0 }).select("id").single();
  if (error || !data) {
    if (error) console.error("crearProducto fallo:", error.code);
    return { error: errorProducto(error?.code), values: valores(formData) };
  }
  // El stock inicial entra como movimiento, para que quede en el historial.
  if (stock > 0 && datos.controla_stock) {
    const r = await supabase.rpc("ajustar_stock", { p_producto: data.id, p_delta: stock });
    if (r.error) console.error("stock inicial fallo:", r.error.code);
  }
  revalidatePath(LISTA);
  redirect(`${LISTA}?ok=creado`);
}

export async function actualizarProducto(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("administrador");
  if (!uuid.safeParse(id).success) return { error: msg("Producto no válido.") };
  const parsed = productoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: valores(formData) };
  const { stock: _stock, ...datos } = parsed.data; // el stock solo cambia con ajustar_stock (queda en el historial)
  void _stock;

  const supabase = await createClient();
  const { data, error } = await supabase.from("products").update(datos).eq("id", id).select("id");
  if (error || !data?.length) {
    if (error) console.error("actualizarProducto fallo:", error.code);
    return { error: errorProducto(error?.code), values: valores(formData) };
  }
  revalidatePath(LISTA);
  redirect(`${LISTA}?ok=guardado`);
}

export async function ajustarStock(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("administrador");
  if (!uuid.safeParse(id).success) return { error: "Producto no válido." };
  const delta = Number(formData.get("delta"));
  if (!Number.isInteger(delta) || delta === 0) return { error: "Escribe una cantidad entera distinta de cero (negativa para descontar)." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("ajustar_stock", { p_producto: id, p_delta: delta });
  if (error) {
    console.error("ajustarStock fallo:", error.code);
    return { error: error.code === "P0001" ? error.message : "No se pudo ajustar el stock." };
  }
  revalidatePath(LISTA);
  revalidatePath(`${LISTA}/${id}`);
  return {};
}

// Soft delete: el producto sale del catalogo pero las ventas anteriores conservan su nombre y precio.
export async function archivarProducto(formData: FormData): Promise<void> {
  await requireRole("administrador");
  const id = formData.get("id");
  if (typeof id !== "string" || !uuid.safeParse(id).success) redirect(LISTA);
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) console.error("archivarProducto fallo:", error.code);
  revalidatePath(LISTA);
  redirect(`${LISTA}?ok=archivado`);
}
