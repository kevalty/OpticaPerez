// Fotos de productos (inventario). Bucket privado "productos" en Supabase Storage.
// El navegador nunca habla con Storage: sube la foto al servidor y la ve a traves de /dashboard/fotos/...
export const BUCKET_FOTOS = "productos";
export const MAX_FOTO_BYTES = 3 * 1024 * 1024; // el navegador ya la reduce a unos cientos de KB
export const urlFotoProducto = (id: string) => `/dashboard/fotos/producto/${id}`;
export const urlFotoVenta = (itemId: string) => `/dashboard/fotos/venta/${itemId}`;

// Reconoce la imagen por su contenido (no por el nombre ni el tipo que declara el cliente).
export function tipoImagen(b: Uint8Array): { ext: "jpg" | "png" | "webp"; mime: string } | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (b.length > 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", mime: "image/png" };
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}
