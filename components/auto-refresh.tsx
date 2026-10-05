"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Refresca los datos de la pagina cada cierto tiempo (solo con la pestana visible).
// Asi la recepcionista ve que un turno paso a "atendido" sin recargar.
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
