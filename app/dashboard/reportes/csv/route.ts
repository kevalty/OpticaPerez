import { TIPOS_CSV, aCsv, filasCsv, type TipoCsv } from "@/lib/reportes";
import { cargarReporte, leerRango } from "@/lib/reportes-server";
import { createClient } from "@/lib/supabase/server";

// Descarga de un reporte en CSV. Requiere sesion y la base solo responde al administrador (reporte_ventas).
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response("No autorizado", { status: 401 });

  const url = new URL(req.url);
  const tipo = (TIPOS_CSV as readonly string[]).includes(url.searchParams.get("tipo") ?? "") ? (url.searchParams.get("tipo") as TipoCsv) : "ventas";
  const { desde, hasta } = leerRango(Object.fromEntries(url.searchParams));
  const { r, error } = await cargarReporte(supabase, desde, hasta);
  if (!r) return new Response(error ?? "No disponible", { status: error?.startsWith("Solo") ? 403 : 400 });

  return new Response(aCsv(filasCsv(tipo, r)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reporte-${tipo}-${desde}_${hasta}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
