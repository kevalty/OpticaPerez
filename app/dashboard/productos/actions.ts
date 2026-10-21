"use server";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { msg } from "@/lib/mensajes";
import { BUCKET_FOTOS, MAX_FOTO_BYTES, tipoImagen } from "@/lib/fotos";
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

// Sube la foto (si viene una) y la deja como foto actual del producto. La foto anterior solo se borra si ninguna venta
// la guardo como evidencia. Devuelve un mensaje de error o null.
async function guardarFoto(supabase: SupabaseClient, id: string, archivo: FormDataEntryValue | null): Promise<string | null> {
  if (!(archivo instanceof File) || archivo.size === 0) return null;
  if (archivo.size > MAX_FOTO_BYTES) return "La foto es demasiado grande (máximo 3 MB).";
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const t = tipoImagen(bytes);
  if (!t) return "La foto debe ser JPG, PNG o WebP.";

  const { data: previo } = await supabase.from("products").select("foto_path").eq("id", id).maybeSingle();
  const path = `${id}/${randomUUID().replaceAll("-", "")}.${t.ext}`;
  const up = await supabase.storage.from(BUCKET_FOTOS).upload(path, bytes, { contentType: t.mime, upsert: false });
  if (up.error) {
    console.error("subir foto fallo:", up.error.name);
    return "No se pudo subir la foto. Revisa la conexión e inténtalo de nuevo.";
  }
  const { data: fila, error } = await supabase.from("products").update({ foto_path: path }).eq("id", id).select("id");
  if (error || !fila?.length) {
    if (error) console.error("guardar foto fallo:", error.code);
    await supabase.storage.from(BUCKET_FOTOS).remove([path]);
    return error?.code === "42703" || error?.code === "PGRST204" ? "Falta actualizar la base de datos (migración 0016). Avisa al administrador." : "No se pudo guardar la foto.";
  }
  const vieja = (previo as { foto_path: string | null } | null)?.foto_path;
  if (vieja && vieja !== path) {
    const { count } = await supabase.from("sale_items").select("id", { count: "exact", head: true }).eq("foto_path", vieja);
    if (count === 0) await supabase.storage.from(BUCKET_FOTOS).remove([vieja]);
  }
  return null;
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
    const r = await supabase.rpc("ajustar_stock", { p_producto: data.id, p_delta: stock, p_nota: "Stock inicial" });
    if (r.error) console.error("stock inicial fallo:", r.error.code);
  }
  const errFoto = await guardarFoto(supabase, data.id, formData.get("foto"));
  const otro = formData.get("otro") === "1";
  revalidatePath(LISTA);
  revalidatePath("/dashboard/inventario");
  // El producto ya existe: si la foto fallo, se lleva a su pantalla para reintentar.
  if (errFoto) redirect(`${LISTA}/${data.id}?aviso=foto`);
  // «Guardar y crear otro»: vuelve al formulario con el mismo tipo, para cargar varios productos seguidos.
  if (otro) redirect(`${LISTA}/nuevo?ok=creado&tipo=${datos.tipo}`);
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
  const errFoto = await guardarFoto(supabase, id, formData.get("foto"));
  if (errFoto) return { error: errFoto, values: valores(formData) };
  const { data, error } = await supabase.from("products").update(datos).eq("id", id).select("id");
  if (error || !data?.length) {
    if (error) console.error("actualizarProducto fallo:", error.code);
    return { error: errorProducto(error?.code), values: valores(formData) };
  }
  revalidatePath(LISTA);
  revalidatePath("/dashboard/inventario");
  redirect(`${LISTA}?ok=guardado`);
}

export async function ajustarStock(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("administrador");
  if (!uuid.safeParse(id).success) return { error: "Producto no válido." };
  const delta = Number(formData.get("delta"));
  if (!Number.isInteger(delta) || delta === 0) return { error: "Escribe una cantidad entera distinta de cero (negativa para descontar)." };

  const supabase = await createClient();
  const nota = String(formData.get("nota") ?? "").trim().slice(0, 200);
  if (nota.length < 3) return { error: "Escribe el motivo del ajuste (por ejemplo: compra, merma, conteo)." };
  const { error } = await supabase.rpc("ajustar_stock", { p_producto: id, p_delta: delta, p_nota: nota });
  if (error) {
    console.error("ajustarStock fallo:", error.code);
    if (error.code === "PGRST202") return { error: "Falta actualizar la base de datos (migración 0015). Avisa al administrador." };
    return { error: error.code === "P0001" ? error.message : "No se pudo ajustar el stock." };
  }
  revalidatePath(LISTA);
  revalidatePath(`${LISTA}/${id}`);
  revalidatePath("/dashboard/inventario");
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
