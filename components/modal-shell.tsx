"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const FOCUSABLES = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

// Ventana emergente accesible y manejable con teclado:
//  - Esc cierra (pide confirmacion si ya se escribio algo).
//  - Tab / Shift+Tab se quedan dentro de la ventana.
//  - Ctrl+Enter guarda (envia el formulario).
//  - Re Pag / Av Pag, flechas y Espacio desplazan la ventana (queda enfocada al abrir).
//  - El fondo no se desplaza mientras esta abierta.
export function ModalShell({ cerrarHref, titulo, children }: { cerrarHref: string; titulo: string; children: React.ReactNode }) {
  const router = useRouter();
  const raiz = useRef<HTMLDivElement>(null);
  const sucio = useRef(false);
  const cerrarRef = useRef(() => {});

  useEffect(() => {
    cerrarRef.current = cerrar;
  });

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    raiz.current?.focus();
    const el = raiz.current;
    const alCerrar = () => cerrarRef.current();
    el?.addEventListener("cerrar-modal", alCerrar);
    return () => {
      el?.removeEventListener("cerrar-modal", alCerrar);
      document.body.style.overflow = overflow;
      previo?.focus?.();
    };
  }, []);

  function cerrar() {
    if (sucio.current && !window.confirm("Hay datos sin guardar en la ficha. ¿Cerrar de todos modos?")) return;
    router.push(cerrarHref);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      cerrar();
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      raiz.current?.querySelector("form")?.requestSubmit();
    } else if (e.key === "Tab") {
      const items = [...(raiz.current?.querySelectorAll<HTMLElement>(FOCUSABLES) ?? [])].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const primero = items[0];
      const ultimo = items[items.length - 1];
      const activo = document.activeElement;
      if (e.shiftKey && (activo === primero || activo === raiz.current)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    }
  }

  return (
    <div
      ref={raiz}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onKeyDown={onKeyDown}
      onInput={() => (sucio.current = true)}
      onClick={(e) => e.target === e.currentTarget && cerrar()}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-3 outline-none sm:p-8"
    >
      {children}
    </div>
  );
}

// Boton "Cerrar" de la cabecera: avisa a la ventana para que aplique la misma confirmacion que Esc.
export function CerrarBoton({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={className}
      onClick={(e) => e.currentTarget.dispatchEvent(new CustomEvent("cerrar-modal", { bubbles: true }))}
    >
      {children}
    </button>
  );
}
