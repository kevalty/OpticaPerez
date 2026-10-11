"use client";

import { useEffect, useRef } from "react";

const EVENTOS = ["pointerdown", "keydown", "scroll", "touchstart"] as const;

// Cierra la sesion tras `minutos` sin actividad (los datos clinicos no deben quedar abiertos en un mostrador).
// `salir` es el formulario de cierre de sesion del encabezado; se envia desde aqui.
export function Inactividad({ minutos = 20, formId }: { minutos?: number; formId: string }) {
  const ultima = useRef(0);

  useEffect(() => {
    ultima.current = Date.now();
    const marcar = () => (ultima.current = Date.now());
    EVENTOS.forEach((e) => window.addEventListener(e, marcar, { passive: true }));
    const id = setInterval(() => {
      if (Date.now() - ultima.current >= minutos * 60_000) {
        (document.getElementById(formId) as HTMLFormElement | null)?.requestSubmit();
      }
    }, 15_000);
    return () => {
      EVENTOS.forEach((e) => window.removeEventListener(e, marcar));
      clearInterval(id);
    };
  }, [minutos, formId]);

  return null;
}
