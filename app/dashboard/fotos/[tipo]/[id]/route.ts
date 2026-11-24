import { BUCKET_FOTOS } from "@/lib/fotos";
import { createClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation";

// tipo -> tabla, columna con la ruta y bucket de Storage
const ORIGEN = {
  producto: { tabla: "products", columna: "foto_path", bucket: BUCKET_FOTOS },
  venta: { tabla: "sale_items", columna: "foto_path", bucket: BUCKET_FOTOS },
  receta: { tabla: "orders", columna: "receta_foto_path", bucket: "recetas" },
  entrega: { tabla: "order_fotos", columna: "path", bucket: "entregas" },
} as const;

// Entrega la foto de un producto, de un renglon de venta, de la copia de receta o de la entrega de un pedido. Requiere sesion; la fila se lee con RLS
// (recepcion solo ve sus ventas) y Storage vuelve a validar el rol. Nada de esto es publico.
export async function GET(_req: Request, ctx: RouteContext<"/dashboard/fotos/[tipo]/[id]">) {
  const { tipo, id } = await ctx.params;
  if (!uuid.safeParse(id).success || !(tipo in ORIGEN)) return new Response("No encontrado", { status: 404 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response("No autorizado", { status: 401 });

  const o = ORIGEN[tipo as keyof typeof ORIGEN];
  const { data: fila } = await supabase.from(o.tabla).select(o.columna).eq("id", id).maybeSingle();
  const path = (fila as Record<string, string | null> | null)?.[o.columna];
  if (!path) return new Response("No encontrado", { status: 404 });

  const { data: blob, error } = await supabase.storage.from(o.bucket).download(path);
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
