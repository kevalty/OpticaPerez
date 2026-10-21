import { BUCKET_FOTOS } from "@/lib/fotos";
import { createClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation";

// Entrega la foto de un producto o la foto guardada en un renglon de venta. Requiere sesion; la fila se lee con RLS
// (recepcion solo ve sus ventas) y Storage vuelve a validar el rol. Nada de esto es publico.
export async function GET(_req: Request, ctx: RouteContext<"/dashboard/fotos/[tipo]/[id]">) {
  const { tipo, id } = await ctx.params;
  if (!uuid.safeParse(id).success || (tipo !== "producto" && tipo !== "venta")) return new Response("No encontrado", { status: 404 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response("No autorizado", { status: 401 });

  const { data: fila } = await supabase
    .from(tipo === "producto" ? "products" : "sale_items")
    .select("foto_path")
    .eq("id", id)
    .maybeSingle();
  const path = (fila as { foto_path: string | null } | null)?.foto_path;
  if (!path) return new Response("No encontrado", { status: 404 });

  const { data: blob, error } = await supabase.storage.from(BUCKET_FOTOS).download(path);
  if (error || !blob) return new Response("No encontrado", { status: 404 });

  return new Response(blob, {
    headers: {
      "Content-Type": blob.type || "image/jpeg",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
