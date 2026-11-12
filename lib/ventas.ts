import { z } from "zod";

export const METODOS = [
  { id: "efectivo", label: "Efectivo" },
  { id: "tarjeta", label: "Tarjeta" },
  { id: "transferencia", label: "Transferencia" },
  { id: "otro", label: "Otro" },
] as const;
export type Metodo = (typeof METODOS)[number]["id"];
export const metodoLabel = (id: string) => METODOS.find((m) => m.id === id)?.label ?? id;

export const TIPOS_PRODUCTO = [
  { id: "montura", label: "Montura" },
  { id: "gafa", label: "Gafa" },
  { id: "lente", label: "Lente" },
  { id: "insumo", label: "Insumo" },
  { id: "servicio", label: "Servicio" },
] as const;
// "Marca Modelo · Color" para mostrar bajo el nombre del producto (vacio si no hay datos).
export const detalleProducto = (p: { marca?: string | null; modelo?: string | null; color?: string | null }): string =>
  [[p.marca, p.modelo].filter(Boolean).join(" "), p.color].filter(Boolean).join(" · ");
export const tipoLabel = (id: string) => TIPOS_PRODUCTO.find((t) => t.id === id)?.label ?? id;

// Debe coincidir con crear_venta() en la base: la recepcionista llega hasta 20 % de descuento total.
export const MAX_DESCUENTO_RECEPCION = 20;

export const dinero = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(n);
export const redondear = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type Producto = { id: string; nombre: string; tipo: string; precio: number; stock: number; controla_stock: boolean; codigo: string | null; marca?: string | null; modelo?: string | null; color?: string | null; foto_v?: string | null };
export type Linea = { product_id: string; nombre: string; tipo: string; precio: number; cantidad: number; descuento_pct: number; stock: number; controla_stock: boolean; foto_v?: string | null };
export type DescuentoGlobal = { tipo: "porcentaje" | "monto"; valor: number };

// Vista previa de totales en pantalla. La fuente de verdad es crear_venta() en la base (mismo calculo y redondeo).
export function calcular(lineas: Linea[], d: DescuentoGlobal) {
  let bruto = 0;
  let subtotal = 0;
  for (const l of lineas) {
    const b = redondear(l.cantidad * l.precio);
    bruto += b;
    subtotal += b - redondear((b * l.descuento_pct) / 100);
  }
  subtotal = redondear(subtotal);
  const global = d.valor > 0 ? redondear(d.tipo === "porcentaje" ? (subtotal * d.valor) / 100 : d.valor) : 0;
  const total = redondear(subtotal - global);
  const descuentoTotal = redondear(bruto - total);
  return {
    bruto: redondear(bruto),
    subtotal,
    global,
    total,
    descuentoTotal,
    pctTotal: bruto > 0 ? (descuentoTotal / bruto) * 100 : 0,
    invalido: global > subtotal,
  };
}

// ---------- Validacion en el servidor de lo que envia la pantalla de venta ----------
const dinero2 = z.number().finite().min(0).max(1_000_000);
export const ventaSchema = z.object({
  patient_id: z.uuid().nullable(),
  observaciones: z.string().trim().max(1000).nullable(),
  items: z
    .array(z.object({ product_id: z.uuid(), cantidad: z.number().int().min(1).max(999), descuento_pct: z.number().min(0).max(100) }))
    .min(1, "Agrega al menos un producto a la venta")
    .max(50, "Una venta admite hasta 50 renglones"),
  descuento: z.object({ tipo: z.enum(["porcentaje", "monto"]), valor: dinero2 }).nullable(),
  pago: z.object({ monto: dinero2, metodo: z.enum(["efectivo", "tarjeta", "transferencia", "otro"]) }).nullable(),
  orden: z.object({ fecha_entrega: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), notas: z.string().trim().max(1000).nullable() }).nullable(),
});
export type VentaInput = z.infer<typeof ventaSchema>;

// ---------- Receta externa: el cliente trae una copia de su receta (no pasa por consultorio ni genera ficha medica) ----------
const medidaRx = z.string().trim().max(12, "Un valor de la receta es demasiado largo").transform((v) => v.replace(/[^\p{L}\p{N}+\-.,/ ]/gu, ""));
const ojoRx = z.object({ esfera: medidaRx, cilindro: medidaRx, eje: medidaRx, add: medidaRx, dp: medidaRx });
export const recetaExternaSchema = z.object({ od: ojoRx, oi: ojoRx, nota: z.string().trim().max(300).transform((v) => v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")) });
export type RecetaExterna = z.infer<typeof recetaExternaSchema>;
export const RX_CAMPOS = [
  { id: "esfera", label: "Esfera" },
  { id: "cilindro", label: "Cilindro" },
  { id: "eje", label: "Eje" },
  { id: "add", label: "ADD" },
  { id: "dp", label: "D.P." },
] as const;
export const recetaVacia = (r: RecetaExterna): boolean => [...Object.values(r.od), ...Object.values(r.oi), r.nota].every((v) => v === "");

// ---------- Productos (catalogo; lo administra el administrador) ----------
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const texto60 = z
  .string()
  .trim()
  .max(60, "Máximo 60 caracteres")
  .transform((v) => (v === "" ? null : v.replace(CTRL, "")));
export const productoSchema = z
  .object({
    nombre: z.string().trim().max(200, "El nombre es demasiado largo").transform((v) => v.replace(CTRL, "")),
    tipo: z.enum(["montura", "gafa", "lente", "insumo", "servicio"], "Elige el tipo de producto"),
    marca: texto60,
    modelo: texto60,
    color: texto60,
    codigo: z
      .string()
      .trim()
      .max(40, "El código es demasiado largo")
      .transform((v) => (v === "" ? null : v.replace(CTRL, ""))),
    precio: z.preprocess((v) => Number(String(v ?? "").replace(",", ".")), z.number("El precio debe ser un número").min(0, "El precio no puede ser negativo").max(100000, "Precio demasiado alto")),
    stock_minimo: z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number("El stock mínimo debe ser un número").int("El stock mínimo debe ser entero").min(0).max(100000)),
    stock: z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number("El stock debe ser un número").int("El stock debe ser entero").min(0).max(100000)),
    controla_stock: z.preprocess((v) => v === "on", z.boolean()),
  })
  .transform((d, ctx) => {
    // Si no se escribe nombre, se arma con marca, modelo y color (monturas y gafas).
    const nombre = d.nombre || [d.marca, d.modelo, d.color].filter(Boolean).join(" ");
    if (!nombre) ctx.issues.push({ code: "custom", message: "Escribe el nombre, o al menos la marca y el modelo", input: d.nombre, path: ["nombre"] });
    return { ...d, nombre };
  });
