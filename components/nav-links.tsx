"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icono } from "@/components/icons";

type Item = { id: string; titulo: string; href: string };

// Navegacion principal: pildoras con icono arriba (pantallas grandes) y barra inferior fija (movil / tablet vertical).
export function NavLinks({ items }: { items: Item[] }) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const todos: Item[] = [{ id: "inicio", titulo: "Inicio", href: "/dashboard" }, ...items];
  const activo = (href: string) => (href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  // Celular: hasta 6 casillas; con mas modulos quedan 5 y un boton "Mas" que abre el resto.
  const cabe = todos.length <= 6;
  const visibles = cabe ? todos : todos.slice(0, 5);
  const masItems = cabe ? [] : todos.slice(5);
  const masActivo = masItems.some((m) => activo(m.href));

  return (
    <>
      <nav aria-label="Principal" className="hidden flex-wrap gap-2 border-b border-brand/10 pb-3 sm:flex print:hidden">
        {todos.map((m) => (
          <Link
            key={m.id}
            href={m.href}
            aria-current={activo(m.href) ? "page" : undefined}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
              activo(m.href) ? "bg-brand text-white" : "text-brand hover:bg-iris-light"
            }`}
          >
            <Icono id={m.id} className="size-5" />
            {m.titulo}
          </Link>
        ))}
      </nav>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-brand/10 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden print:hidden"
      >
        {visibles.map((m) => (
          <Link
            key={m.id}
            href={m.href}
            onClick={() => setAbierto(false)}
            aria-current={activo(m.href) ? "page" : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium ${activo(m.href) ? "text-brand" : "text-brand-dark/50"}`}
          >
            <span className={`flex h-8 w-12 items-center justify-center rounded-full ${activo(m.href) ? "bg-iris-light" : ""}`}>
              <Icono id={m.id} className="size-6" />
            </span>
            <span className="truncate">{m.titulo}</span>
          </Link>
        ))}
        {masItems.length > 0 && (
          <button
            type="button"
            aria-expanded={abierto}
            aria-controls="menu-mas"
            onClick={() => setAbierto((a) => !a)}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium ${abierto || masActivo ? "text-brand" : "text-brand-dark/50"}`}
          >
            <span className={`flex h-8 w-12 items-center justify-center rounded-full text-xl leading-none ${abierto || masActivo ? "bg-iris-light" : ""}`}>⋯</span>
            <span>Más</span>
          </button>
        )}
      </nav>

      {abierto && masItems.length > 0 && (
        <div id="menu-mas" className="fixed inset-x-0 bottom-[4.25rem] z-40 border-t border-brand/10 bg-white p-3 pb-4 shadow-lg sm:hidden print:hidden">
          <ul className="grid grid-cols-3 gap-2">
            {masItems.map((m) => (
              <li key={m.id}>
                <Link
                  href={m.href}
                  onClick={() => setAbierto(false)}
                  aria-current={activo(m.href) ? "page" : undefined}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs font-medium ${activo(m.href) ? "bg-iris-light text-brand" : "text-brand hover:bg-iris-light/60"}`}
                >
                  <Icono id={m.id} className="size-6" />
                  <span className="text-center leading-tight">{m.titulo}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
