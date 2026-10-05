import { z } from "zod";

// Medidas que se anotan por ojo (OD = derecho, OI = izquierdo) en la ficha de Optica Perez.
export const PARES = [
  { key: "rx_anterior", label: "Rx anterior" },
  { key: "add", label: "Add." },
  { key: "avcc", label: "A.V.C.C." },
  { key: "avsc", label: "A.V.S.C." },
  { key: "ppc", label: "P.P.C." },
  { key: "queratometria", label: "Queratometría" },
  { key: "oftalmoscopia", label: "Oftalmoscopia" },
  { key: "retinoscopia", label: "Retinoscopia" },
  { key: "lectura_computador", label: "Lectura de computador" },
] as const;

export const RX_CAMPOS = [
  { key: "esfera", label: "Esfera", step: "0.25", min: -30, max: 30 },
  { key: "cilindro", label: "Cilindro", step: "0.25", min: -15, max: 15 },
  { key: "eje", label: "Eje", step: "1", min: 0, max: 180 },
  { key: "av", label: "A.V.", text: true },
  { key: "add", label: "ADD", step: "0.25", min: 0, max: 6 },
  { key: "dp", label: "D.P.", step: "0.5", min: 0, max: 100 },
] as const;

export const OJOS = [
  { id: "OD", label: "OD (derecho)", suf: "od" },
  { id: "OI", label: "OI (izquierdo)", suf: "oi" },
] as const;

export type RxRow = {
  ojo: "OD" | "OI";
  esfera: number | null;
  cilindro: number | null;
  eje: number | null;
  av: string | null;
  add: number | null;
  dp: number | null;
  color: string | null;
  bifocal: boolean;
};
export type ClRow = { ojo: "OD" | "OI"; prueba: string | null; av: string | null };

export type Ficha = {
  id: string;
  fecha: string;
  optometrista_id: string;
  observaciones: string | null;
  recomendaciones: string | null;
  indicaciones_recepcion: string | null;
  [campo: string]: string | number | boolean | null; // pares *_od / *_oi y datos del certificado
};

// ---------- Validacion de lo que llega del formulario ----------
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const texto = (max: number) =>
  z
    .preprocess((v) => (v == null ? "" : v), z.string().trim().max(max, `Un campo supera los ${max} caracteres`))
    .transform((v) => (v === "" ? null : v.replace(CONTROL, "")));

const numero = (label: string, min: number, max: number, entero = false) =>
  z.preprocess(
    (v) => (v == null || v === "" ? null : Number(v)),
    (entero ? z.number().int(`${label}: debe ser entero`) : z.number(`${label}: debe ser un número`))
      .min(min, `${label}: mínimo ${min}`)
      .max(max, `${label}: máximo ${max}`)
      .nullable(),
  );

const shape: Record<string, z.ZodType> = {
  observaciones: texto(5000),
  recomendaciones: texto(5000),
  indicaciones_recepcion: texto(2000),
  color: texto(60),
  bifocal: z.preprocess((v) => v === "on", z.boolean()),
};
// Datos que lleva el certificado impreso
shape.avh_condicion = texto(60);
shape.avh_od = texto(30);
shape.avh_oi = texto(30);
shape.rx_tipo = texto(30);
shape.cie_od = texto(60);
shape.cie_oi = texto(60);
shape.test_colores = texto(60);
shape.necesita_lentes = z.preprocess((v) => (v === "si" ? true : v === "no" ? false : null), z.boolean().nullable());
shape.control_meses = numero("Control (meses)", 1, 60, true);
for (const p of PARES) for (const o of OJOS) shape[`${p.key}_${o.suf}`] = texto(200);
for (const o of OJOS) {
  for (const c of RX_CAMPOS) {
    shape[`rx_${o.suf}_${c.key}`] = "text" in c ? texto(30) : numero(`${c.label} ${o.id}`, c.min, c.max, c.key === "eje");
  }
  shape[`cl_${o.suf}_prueba`] = texto(200);
  shape[`cl_${o.suf}_av`] = texto(30);
}

export const fichaSchema = z.object(shape);

// Convierte los campos planos del formulario al JSON que espera guardar_ficha() en la BD.
export function buildFichaPayload(d: Record<string, unknown>) {
  const out: Record<string, unknown> = {
    observaciones: d.observaciones,
    recomendaciones: d.recomendaciones,
    indicaciones_recepcion: d.indicaciones_recepcion,
    avh_condicion: d.avh_condicion,
    avh_od: d.avh_od,
    avh_oi: d.avh_oi,
    rx_tipo: d.rx_tipo,
    cie_od: d.cie_od,
    cie_oi: d.cie_oi,
    test_colores: d.test_colores,
    necesita_lentes: d.necesita_lentes,
    control_meses: d.control_meses,
  };
  for (const p of PARES) for (const o of OJOS) out[`${p.key}_${o.suf}`] = d[`${p.key}_${o.suf}`];
  out.rx = OJOS.map((o) => ({
    ojo: o.id,
    esfera: d[`rx_${o.suf}_esfera`],
    cilindro: d[`rx_${o.suf}_cilindro`],
    eje: d[`rx_${o.suf}_eje`],
    av: d[`rx_${o.suf}_av`],
    add: d[`rx_${o.suf}_add`],
    dp: d[`rx_${o.suf}_dp`],
    color: d.color,
    bifocal: d.bifocal,
  }));
  out.cl = OJOS.map((o) => ({ ojo: o.id, prueba: d[`cl_${o.suf}_prueba`], av: d[`cl_${o.suf}_av`] }));
  return out;
}

// Una ficha sin ningun dato no tiene sentido guardarla.
export function fichaVacia(payload: Record<string, unknown>): boolean {
  const vacio = (v: unknown) => v == null || v === "" || v === false;
  const sueltos = Object.entries(payload).filter(([k]) => k !== "rx" && k !== "cl" && k !== "rx_tipo");
  const rx = (payload.rx as Record<string, unknown>[]).flatMap((r) => Object.entries(r).filter(([k]) => k !== "ojo"));
  const cl = (payload.cl as Record<string, unknown>[]).flatMap((r) => Object.entries(r).filter(([k]) => k !== "ojo"));
  return [...sueltos, ...rx, ...cl].every(([, v]) => vacio(v));
}

// Texto "esf cil x eje" de una fila de Rx, para rellenar "Rx anterior" en la consulta siguiente.
export function rxComoTexto(r: Pick<RxRow, "esfera" | "cilindro" | "eje">): string {
  const f = (n: number) => (n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2));
  const partes = [r.esfera != null ? f(r.esfera) : null, r.cilindro != null ? f(r.cilindro) : null].filter(Boolean);
  if (partes.length === 0) return "";
  return partes.join(" ") + (r.eje != null && r.cilindro != null ? ` x ${r.eje}°` : "");
}

// Formato clinico de un valor de la tabla Rx: esfera/cilindro/add con signo y 2 decimales.
export function formatRx(key: string, valor: string | number | null | undefined): string {
  if (valor == null || valor === "") return "—";
  if (typeof valor === "number" && (key === "esfera" || key === "cilindro" || key === "add")) {
    return valor > 0 ? `+${valor.toFixed(2)}` : valor.toFixed(2);
  }
  return String(valor);
}
