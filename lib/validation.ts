import { z } from "zod";

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const optionalText = (max: number) =>
  z
    .preprocess((v) => (v == null ? "" : v), z.string().trim().max(max, `Máximo ${max} caracteres`))
    .transform((v) => (v === "" ? null : v.replace(CONTROL_CHARS, "")));

// Cedula ecuatoriana: 10 digitos, provincia 01-24 o 30, tercer digito < 6 y digito verificador (modulo 10).
export function isValidCedulaEC(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false;
  const province = Number(value.slice(0, 2));
  if (!((province >= 1 && province <= 24) || province === 30)) return false;
  if (Number(value[2]) >= 6) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let n = Number(value[i]) * (i % 2 === 0 ? 2 : 1);
    if (n > 9) n -= 9;
    sum += n;
  }
  return (10 - (sum % 10)) % 10 === Number(value[9]);
}

export const patientSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(1, "El nombre es obligatorio")
      .max(200, "El nombre es demasiado largo")
      .transform((v) => v.replace(CONTROL_CHARS, "")),
    tipo_documento: z.enum(["cedula", "pasaporte"], "Elige el tipo de documento"),
    documento: z.string().trim().min(1, "El número de documento es obligatorio").max(20, "El documento es demasiado largo"),
    telefono: z
      .string("El celular es obligatorio")
      .trim()
      .min(1, "El celular es obligatorio")
      .max(30)
      .regex(/^[0-9+()\-\s.]+$/, "El celular solo puede tener números, espacios y + ( ) -")
      .refine((v) => v.replace(/\D/g, "").length >= 9 && v.replace(/\D/g, "").length <= 15, {
        message: "El celular debe tener entre 9 y 15 dígitos",
      }),
    direccion: optionalText(300),
    edad: z.preprocess(
      (v) => (v == null || v === "" ? null : Number(v)),
      z.number("La edad debe ser un número").int("La edad debe ser un número entero").min(0, "Edad no válida").max(130, "Edad no válida").nullable(),
    ),
    ocupacion: optionalText(120),
  })
  .superRefine((p, ctx) => {
    if (p.tipo_documento === "cedula" && !isValidCedulaEC(p.documento)) {
      ctx.addIssue({ code: "custom", path: ["documento"], message: "La cédula no es válida. Revisa los 10 dígitos." });
    }
    if (p.tipo_documento === "pasaporte" && !/^[A-Za-z0-9]{5,20}$/.test(p.documento)) {
      ctx.addIssue({ code: "custom", path: ["documento"], message: "El pasaporte debe tener entre 5 y 20 letras o números." });
    }
  });

export const uuid = z.string().uuid();

export const appointmentStatus = z.enum(["agendado", "en_espera", "en_consulta", "atendido", "finalizado"]);
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
