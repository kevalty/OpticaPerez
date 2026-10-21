"use client";

import { useEffect, useRef, useState } from "react";
import { btnGhost } from "@/lib/ui";

// Reduce la foto en el celular (maximo 1280 px, JPEG): sube en segundos aunque haya poca senal y corrige la rotacion.
async function reducir(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error("imagen"));
      i.src = url;
    });
    const escala = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * escala));
    c.height = Math.max(1, Math.round(img.naturalHeight * escala));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.82));
    if (!blob) throw new Error("imagen");
    return new File([blob], "foto.jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Campo de foto para celular: "Tomar foto" abre la camara y "Galeria" deja elegir una existente.
export function FotoCampo({ actual, onChange }: { actual?: string | null; onChange: (f: File | null) => void }) {
  const [vista, setVista] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (vista) URL.revokeObjectURL(vista); }, [vista]);

  async function elegida(file: File | undefined) {
    if (!file) return;
    setError("");
    setTrabajando(true);
    try {
      const chica = await reducir(file);
      setVista((v) => { if (v) URL.revokeObjectURL(v); return URL.createObjectURL(chica); });
      onChange(chica);
    } catch {
      setError("No se pudo leer esa imagen. Prueba con otra foto.");
    } finally {
      setTrabajando(false);
    }
  }
  const src = vista ?? actual ?? null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-brand">Foto del producto</span>
      <div className="flex aspect-[4/3] w-full max-w-sm items-center justify-center overflow-hidden rounded-2xl bg-iris-light/40 ring-1 ring-brand/10">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Foto del producto" className="size-full object-contain" />
        ) : (
          <span className="px-4 text-center text-sm text-brand-dark/60">Aún no hay foto. Toma una con la cámara.</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={trabajando} onClick={() => camara.current?.click()} className={`${btnGhost} !min-h-12 flex-1 sm:flex-none`}>
          {trabajando ? "Preparando…" : src ? "Cambiar con cámara" : "Tomar foto"}
        </button>
        <button type="button" disabled={trabajando} onClick={() => galeria.current?.click()} className={`${btnGhost} !min-h-12 flex-1 sm:flex-none`}>Elegir de la galería</button>
      </div>
      <input ref={camara} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void elegida(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={galeria} type="file" accept="image/*" hidden onChange={(e) => { void elegida(e.target.files?.[0]); e.target.value = ""; }} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
