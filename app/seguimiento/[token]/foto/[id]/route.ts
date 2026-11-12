import { createClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation";

// Foto de la entrega para la pagina publica del cliente. Solo con el token exclusivo de SU pedido; la ruta del archivo
// la entrega la base (seguimiento_foto_path) y el archivo se descarga con permiso de lectura limitado a fotos de entrega.
export async function GET(_req: Request, ctx: RouteContext<"/seguimiento/[token]/foto/[id]">) {
  const { token, id } = await ctx.params;
  if (!/^[0-9a-f]{64}$/.test(token) || !uuid.safeParse(id).success) return new Response("No encontrado", { status: 404 });
  const supabase = await createClient();
  const { data: path } = await supabase.rpc("seguimiento_foto_path", { p_token: token, p_foto: id });
  if (typeof path !== "string") return new Response("No encontrado", { status: 404 });
  const { data: blob, error } = await supabase.storage.from("entregas").download(path);
  if (error || !blob) return new Response("No encontrado", { status: 404 });
  return new Response(blob, {
    headers: {
      "Content-Type": blob.type || "image/jpeg",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
      "Content-Disposition": "inline",
    },
  });
}
