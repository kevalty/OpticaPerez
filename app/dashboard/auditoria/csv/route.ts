import { ACCION_ETIQUETA, TABLA_ETIQUETA, type RegistroAuditoria } from "@/lib/auditoria";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { aCsv } from "@/lib/reportes";
import { createClient } from "@/lib/supabase/server";
import { fechaHoraLocal, isISODate, shiftDate, todayISO } from "@/lib/time";
import { cleanSearch, uuid } from "@/lib/validation";

// Descarga de la bitacora en CSV (solo administrador; la base rechaza a cualquier otro rol). Hasta 1000 registros.
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response("No autorizado", { status: 401 });

  const p = new URL(req.url).searchParams;
  const hoy = todayISO();
  let desde = isISODate(p.get("desde")) ? (p.get("desde") as string) : shiftDate(hoy, -6);
  let hasta = isISODate(p.get("hasta")) ? (p.get("hasta") as string) : hoy;
  if (hasta < desde) [desde, hasta] = [hasta, desde];
  const tabla = Object.keys(TABLA_ETIQUETA).includes(p.get("tabla") ?? "") ? p.get("tabla") : null;
  const accion = Object.keys(ACCION_ETIQUETA).includes(p.get("accion") ?? "") ? p.get("accion") : null;
  const usuario = uuid.safeParse(p.get("usuario")).success ? p.get("usuario") : null;

  const { data, error } = await supabase.rpc("auditoria_registros", { p_desde: desde, p_hasta: hasta, p_tabla: tabla, p_accion: accion, p_usuario: usuario, p_q: cleanSearch(p.get("q")) || null, p_limite: 1000 });
  if (error) {
    console.error("auditoria csv fallo:", error.code);
    return new Response(error.code === "42501" ? "Solo el administrador puede descargar la auditoría." : "No se pudo generar el archivo.", { status: error.code === "42501" ? 403 : 400 });
  }
  const filas = (data ?? []) as RegistroAuditoria[];
  const csv = aCsv([
    ["Fecha y hora", "Usuario", "Rol", "Acción", "Qué", "Paciente"],
    ...filas.map((f) => [fechaHoraLocal(f.created_at), f.usuario, f.rol ? (ROLE_LABEL[f.rol as Role] ?? f.rol) : "", ACCION_ETIQUETA[f.accion] ?? f.accion, TABLA_ETIQUETA[f.tabla] ?? f.tabla, f.paciente ?? ""]),
  ]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="auditoria-${desde}_${hasta}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
