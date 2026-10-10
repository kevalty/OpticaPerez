"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icono } from "@/components/icons";

type Item = { id: string; titulo: string; href: string };

// Navegacion principal: pildoras con icono arriba (pantallas grandes) y barra inferior fija (movil / tablet vertical).
export function NavLinks({ items }: { items: Item[] }) {
  const pathname = usePathname();
  const todos: Item[] = [{ id: "inicio", titulo: "Inicio", href: "/dashboard" }, ...items];
  const activo = (href: string) => (href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <>
      <nav aria-label="Principal" className="hidden flex-wrap gap-2 border-b border-brand/10 pb-3 sm:flex print:hidden">
        {todos.map((m) => (
          <Link
            key={m.id}
            href={m.href}
            aria-current={activo(m.href) ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
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
        {todos.map((m) => (
          <Link
            key={m.id}
            href={m.href}
            aria-current={activo(m.href) ? "page" : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium ${activo(m.href) ? "text-brand" : "text-brand-dark/50"}`}
          >
            <span className={`flex h-8 w-12 items-center justify-center rounded-full ${activo(m.href) ? "bg-iris-light" : ""}`}>
              <Icono id={m.id} className="size-6" />
            </span>
            <span className="truncate">{m.titulo}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
