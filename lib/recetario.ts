// Recetario de lentes (hoja "RECETARIO" que se envia al laboratorio). Se llena en la consulta,
// junto con la ficha, y se guarda dentro de la ficha (columna medical_records.recetario).

export const REC_COLUMNAS = [
  { key: "esfera", label: "Esfera" },
  { key: "cilindro", label: "Cilindro" },
  { key: "eje", label: "Eje" },
  { key: "prisma", label: "Prisma" },
  { key: "base", label: "Base" },
  { key: "adicion", label: "Adición" },
  { key: "altura", label: "Altura" },
  { key: "dp_lejos", label: "DP Lejos" },
  { key: "dp_cerca", label: "DP Cerca" },
] as const;
export type RecCol = (typeof REC_COLUMNAS)[number]["key"];

export const REC_OJOS = [
  { id: "OD", suf: "od" },
  { id: "OI", suf: "oi" },
] as const;

type Opcion = { id: string; label: string };

export const DISENOS: Opcion[] = [
  { id: "vision_sencilla", label: "Visión Sencilla" },
  { id: "progresivo", label: "Progresivo" },
  { id: "ocupacional", label: "Ocupacional" },
];
export const TRATAMIENTOS: Opcion[] = [
  { id: "crizal_uv", label: "Crizal UV" },
  { id: "xperio", label: "Xperio" },
  { id: "transitions", label: "Transitions" },
];
export const EXTERIORES: Opcion[] = [
  { id: "xperio_polarizado", label: "Xperio (Polarizado)" },
  { id: "tintado", label: "Tintado" },
];
export const MATERIALES: Opcion[] = [
  { id: "airwear", label: "Airwear" },
  { id: "orma", label: "Orma" },
  { id: "thin_lite", label: "Thin & Lite" },
];

// Un par de lentes (primario o segundo par).
export type Par = {
  od: Record<RecCol, string | null>;
  oi: Record<RecCol, string | null>;
  diseno: string | null;
  diseno_detalle: string | null;
  tratamientos: string[];
  tratamiento_otro: string | null;
  exteriores: string[];
  exteriores_detalle: string | null;
  material: string | null;
  material_otro: string | null;
};
export type Recetario = { fecha_entrega: string | null; primaria: Par | null; segundo: Par | null };

// Prefijo de los campos del formulario: p = primera prescripcion, s = segundo par.
export type Prefijo = "p" | "s";
export const campo = (pre: Prefijo, ...partes: string[]) => ["rec", pre, ...partes].join("_");

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const limpio = (v: FormDataEntryValue | null, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(CONTROL, "").trim().slice(0, max);
  return t === "" ? null : t;
};
const elegido = (v: FormDataEntryValue | null, validos: Opcion[]): string | null =>
  typeof v === "string" && validos.some((o) => o.id === v) ? v : v === "otro" ? "otro" : null;
const varios = (vs: FormDataEntryValue[], validos: Opcion[]) => [
  ...new Set(vs.filter((v): v is string => typeof v === "string" && (v === "otro" || validos.some((o) => o.id === v)))),
];

function leerPar(fd: FormData, pre: Prefijo): Par | null {
  const ojo = (suf: string) =>
    Object.fromEntries(REC_COLUMNAS.map((c) => [c.key, limpio(fd.get(campo(pre, suf, c.key)), 12)])) as Par["od"];
  const par: Par = {
    od: ojo("od"),
    oi: ojo("oi"),
    diseno: elegido(fd.get(campo(pre, "diseno")), DISENOS),
    diseno_detalle: limpio(fd.get(campo(pre, "diseno_detalle")), 60),
    tratamientos: varios(fd.getAll(campo(pre, "trat")), TRATAMIENTOS),
    tratamiento_otro: limpio(fd.get(campo(pre, "trat_otro")), 60),
    exteriores: pre === "s" ? varios(fd.getAll(campo(pre, "ext")), EXTERIORES) : [],
    exteriores_detalle: pre === "s" ? limpio(fd.get(campo(pre, "ext_detalle")), 60) : null,
    material: elegido(fd.get(campo(pre, "mat")), MATERIALES),
    material_otro: limpio(fd.get(campo(pre, "mat_otro")), 60),
  };
  return parVacio(par) ? null : par;
}

export function parVacio(p: Par | null | undefined): boolean {
  if (!p) return true;
  const medidas = [...Object.values(p.od), ...Object.values(p.oi)].some((v) => v != null && v !== "");
  return !(
    medidas ||
    p.diseno ||
    p.diseno_detalle ||
    p.tratamientos.length ||
    p.tratamiento_otro ||
    p.exteriores.length ||
    p.exteriores_detalle ||
    p.material ||
    p.material_otro
  );
}

// Devuelve null si el doctor no lleno nada del recetario (es opcional).
export function leerRecetario(fd: FormData): { ok: true; value: Recetario | null } | { ok: false; error: string } {
  const f = limpio(fd.get("rec_fecha_entrega"), 10);
  if (f && !/^\d{4}-\d{2}-\d{2}$/.test(f)) return { ok: false, error: "La fecha de entrega del recetario no es válida." };
  const primaria = leerPar(fd, "p");
  const segundo = leerPar(fd, "s");
  if (!primaria && !segundo && !f) return { ok: true, value: null };
  return { ok: true, value: { fecha_entrega: f, primaria, segundo } };
}

export const etiqueta = (opciones: Opcion[], id: string | null) =>
  id ? (opciones.find((o) => o.id === id)?.label ?? id) : null;

// "Progresivo", "Crizal UV + Transitions + Otro (xxx)", etc. para resumenes en pantalla.
export function resumenPar(p: Par): { diseno: string | null; tratamiento: string | null; exteriores: string | null; material: string | null } {
  const lista = (ids: string[], op: Opcion[], otro: string | null) =>
    ids.map((id) => (id === "otro" ? `Otro${otro ? ` (${otro})` : ""}` : etiqueta(op, id))).join(" + ") || null;
  const un = (id: string | null, op: Opcion[], otro: string | null) =>
    id ? (id === "otro" ? `Otro${otro ? ` (${otro})` : ""}` : etiqueta(op, id)) : null;
  return {
    diseno: p.diseno ? `${etiqueta(DISENOS, p.diseno)}${p.diseno_detalle ? ` — ${p.diseno_detalle}` : ""}` : p.diseno_detalle,
    tratamiento: lista(p.tratamientos, TRATAMIENTOS, p.tratamiento_otro),
    exteriores: lista(p.exteriores, EXTERIORES, p.exteriores_detalle),
    material: un(p.material, MATERIALES, p.material_otro),
  };
}
