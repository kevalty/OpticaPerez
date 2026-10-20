"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BADGE_ESTADO, estadoInfo, fechaCorta } from "@/lib/pedidos";
import { card, inputCls } from "@/lib/ui";
import { dinero } from "@/lib/ventas";

export type FilaPedido = { id: string; numero: number | null; paciente: string; telefono: string | null; estado: string; fecha_entrega: string | null; saldo: number | null };

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Lista de pedidos con buscador en la propia pagina (nombre del paciente o numero): lo escrito no va a la URL.
export function ListaPedidos({ pedidos, hoy }: { pedidos: FilaPedido[]; hoy: string }) {
  const [q, setQ] = useState("");
  const filtrados = useMemo(() => {
    const t = norm(q.trim());
    if (!t) return pedidos;
    return pedidos.filter((p) => norm(p.paciente).includes(t) || String(p.numero ?? "").includes(t.replace(/^0+/, "")));
  }, [pedidos, q]);

  return (
    <>
      <input name="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por paciente o N.º de venta" autoComplete="off" aria-label="Buscar pedido" className={inputCls} />
      <section data-lista className={`${card} divide-y divide-brand/10 p-0`}>
        {filtrados.length === 0 ? (
          <p className="p-5 text-sm text-brand-dark/70">{q ? "No hay pedidos que coincidan." : "No hay pedidos en esta vista."}</p>
        ) : (
          filtrados.map((p) => {
            const atrasado = p.fecha_entrega != null && p.fecha_entrega < hoy && !["listo_para_recibir", "entregado"].includes(p.estado);
            return (
              <Link key={p.id} href={`/dashboard/pedidos/${p.id}`} className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3 outline-none hover:bg-iris-light/50 focus-visible:bg-iris-light">
                <span>
                  <span className="font-mono text-sm text-brand-dark/60">N.º {String(p.numero ?? 0).padStart(6, "0")}</span>
                  <span className="ml-3 font-medium text-brand">{p.paciente}</span>
                  {p.fecha_entrega && <span className={`ml-2 text-xs ${atrasado ? "font-semibold text-red-700" : "text-brand-dark/60"}`}>entrega {fechaCorta(p.fecha_entrega)}{atrasado ? " · atrasado" : ""}</span>}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {p.saldo != null && p.saldo > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">Saldo {dinero(p.saldo)}</span>}
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_ESTADO[p.estado] ?? ""}`}>{estadoInfo(p.estado)?.label ?? p.estado}</span>
                </span>
              </Link>
            );
          })
        )}
      </section>
    </>
  );
}
