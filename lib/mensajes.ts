// Los mensajes de error viajan en la URL (?error=...). Solo se muestran si el propio sistema los
// registro con msg(); cualquier otro texto (p. ej. un enlace armado por un tercero) se reemplaza.
const conocidos = new Set<string>();

export function msg(texto: string): string {
  conocidos.add(texto);
  return texto;
}

export function mensajeSeguro(
  valor: string | string[] | undefined,
  generico = "No se pudo completar la acción. Inténtalo de nuevo.",
): string | null {
  const s = Array.isArray(valor) ? valor[0] : valor;
  if (!s) return null;
  return conocidos.has(s) ? s : generico;
}
