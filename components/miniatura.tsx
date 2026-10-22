import { urlFotoProducto } from "@/lib/fotos";

// Miniatura cuadrada del producto (carga perezosa). Sin foto muestra un recuadro neutro.
export function Miniatura({ id, version, className = "size-14" }: { id: string; version?: string | null; className?: string }) {
  return version ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={urlFotoProducto(id, version)} alt="" loading="lazy" className={`${className} shrink-0 rounded-lg bg-iris-light/40 object-cover ring-1 ring-brand/10`} />
  ) : (
    <span aria-hidden className={`${className} flex shrink-0 items-center justify-center rounded-lg bg-iris-light/40 text-xs text-brand-dark/40 ring-1 ring-brand/10`}>Sin foto</span>
  );
}
