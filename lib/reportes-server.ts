import type { SupabaseClient } from "@supabase/supabase-js";
import { rangosRapidos, type Reporte } from "@/lib/reportes";
import { isISODate, todayISO } from "@/lib/time";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Periodo pedido en la URL (solo fechas; no hay datos personales). Por defecto: del 1.º del mes a hoy.
export function leerRango(sp: Record<string, string | string[] | undefined>): { desde: string; hasta: string } {
  const mes = rangosRapidos(todayISO()).find((r) => r.id === "mes")!;
  let desde = isISODate(one(sp.desde)) ? (one(sp.desde) as string) : mes.desde;
  let hasta = isISODate(one(sp.hasta)) ? (one(sp.hasta) as string) : mes.hasta;
  if (hasta < desde) [desde, hasta] = [hasta, desde];
  return { desde, hasta };
}

export async function cargarReporte(supabase: SupabaseClient, desde: string, hasta: string): Promise<{ r?: Reporte; error?: string }> {
  const { data, error } = await supabase.rpc("reporte_ventas", { p_desde: desde, p_hasta: hasta });
  if (error) {
    console.error("reporte_ventas fallo:", error.code);
    if (error.code === "P0001") return { error: error.message };
    if (error.code === "42883" || error.code === "PGRST202") return { error: "Falta actualizar la base de datos (migración 0021). Avisa al administrador." };
    if (error.code === "42501") return { error: "Solo el administrador puede ver los reportes." };
    return { error: "No se pudo generar el reporte. Inténtalo de nuevo." };
  }
  return { r: data as Reporte };
}
