"use client";

import { useEffect } from "react";

// Tras guardar una ficha, borra del navegador los borradores clinicos (sessionStorage) para que no queden en un equipo compartido.
export function LimpiarBorradores() {
  useEffect(() => {
    try {
      for (const k of Object.keys(sessionStorage)) if (k.startsWith("ficha_borrador_")) sessionStorage.removeItem(k);
    } catch {}
  }, []);
  return null;
}
