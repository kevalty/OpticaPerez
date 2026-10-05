import { z } from "zod";

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const optionalText = (max: number) =>
  z
    .preprocess((v) => (v == null ? "" : v), z.string().trim().max(max, `Máximo ${max} caracteres`))
    .transform((v) => (v === "" ? null : v.replace(CONTROL_CHARS, "")));

export const patientSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(200, "El nombre es demasiado largo")
    .transform((v) => v.replace(CONTROL_CHARS, "")),
  direccion: optionalText(300),
  telefono: optionalText(30).refine((v) => v === null || /^[0-9+()\-\s.]+$/.test(v), {
    message: "El teléfono solo puede tener números, espacios y + ( ) - .",
  }),
  edad: z.preprocess(
    (v) => (v == null || v === "" ? null : Number(v)),
    z.number("La edad debe ser un número").int("La edad debe ser un número entero").min(0, "Edad no válida").max(130, "Edad no válida").nullable(),
  ),
  ocupacion: optionalText(120),
});

export const uuid = z.string().uuid();

export const appointmentStatus = z.enum(["en_espera", "en_consulta", "atendido"]);
export type AppointmentStatus = z.infer<typeof appointmentStatus>;

// Texto de busqueda: solo letras, numeros, espacios y + . -  (evita inyectar sintaxis de filtros)
export function cleanSearch(value: unknown): string {
  const v = Array.isArray(value) ? value[0] : value;
  if (typeof v !== "string") return "";
  return v.replace(/[^\p{L}\p{N}\s+.\-]/gu, "").trim().slice(0, 60);
}

export function optionalUuid(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && uuid.safeParse(value).success ? value : null;
}

export type FormState = { error?: string };
