"use client";

import { useEffect } from "react";

const esCampo = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

// Atajos de teclado globales (se ignoran dentro de una ventana emergente, que maneja los suyos):
//   /            enfoca el buscador de la pagina
//   ↓ / ↑        recorre las listas marcadas con data-lista (pacientes, resultados) desde el buscador o la propia lista
//   Esc          sale del buscador
export function Atajos() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('[role="dialog"]')) return;
      const buscador = document.querySelector<HTMLInputElement>('input[name="q"]');

      if (e.key === "/" && !esCampo(e.target) && buscador) {
        e.preventDefault();
        buscador.focus();
        buscador.select();
        return;
      }
      if (e.key === "Escape" && e.target === buscador) {
        buscador?.blur();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const items = [...document.querySelectorAll<HTMLElement>("[data-lista] a")];
      if (items.length === 0) return;
      const i = items.findIndex((el) => el === document.activeElement);
      const enBuscador = e.target === buscador;
      if (i === -1 && !enBuscador) return; // no se secuestran las flechas si el foco esta en otra parte
      e.preventDefault();
      if (e.key === "ArrowDown") (items[i + 1] ?? items[0]).focus();
      else if (i <= 0) buscador?.focus();
      else items[i - 1].focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
