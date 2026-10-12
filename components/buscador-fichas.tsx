"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { buscarFichas } from "@/app/dashboard/fichas/actions";
import type { FichaFila } from "@/lib/fichas-server";
import { btnGhost, card, inputCls } from "@/lib/ui";

const LIMITE = 50;
const fecha = (iso: string) => iso.split("-").reverse().join("/");

// Buscador + lista de fichas. Lo escrito no va a la URL (nombre y cedula son datos personales).
export function BuscadorFichas({ inicial }: { inicial: FichaFila[] }) {
  const [q, setQ] = useState("");
  const [lista, setLista] = useState(inicial);
  const [buscando, startTransition] = useTransition();
  const ultima = useRef(0);

  function buscar(texto: string) {
    const turno = ++ultima.current;
    startTransition(async () => {
      const r = await buscarFichas(texto);
      if (turno === ultima.current) setLista(r);
    });
  }

  useEffect(() => {
    if (q === "") return;
    const id = setTimeout(() => buscar(q), 300);
    return () => clearTimeout(id);
  }, [q]);

  return (
    <>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          buscar(q);
        }}
        className="flex gap-2"
      >
        <input
          name="q"
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (e.target.value === "") buscar("");
          }}
          placeholder="Buscar ficha por nombre o cédula del paciente"
          maxLength={60}
          autoComplete="off"
          aria-label="Buscar ficha"
          className={inputCls}
        />
        <button className={btnGhost}>Buscar</button>
      </form>

      <section data-lista aria-busy={buscando} className={`${card} divide-y divide-brand/10 p-0 ${buscando ? "opacity-70" : ""}`}>
        {lista.length === 0 ? (
          <p className="p-5 text-sm text-brand-dark/70">{q ? "No hay fichas que coincidan." : "Aún no hay fichas médicas. Se crean durante la consulta, desde Turnos."}</p>
        ) : (
          lista.map((f) => (
            <Link
              key={f.id}
              href={`/dashboard/fichas/${f.id}`}
              className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3 outline-none hover:bg-iris-light/50 focus-visible:bg-iris-light"
            >
              <span>
                <span className="font-medium text-brand">{f.paciente}</span>
                {f.documento && <span className="ml-2 text-xs text-brand-dark/60">{f.documento}</span>}
              </span>
              <span className="text-xs text-brand-dark/60 sm:text-sm">
                {fecha(f.fecha)} · {f.doctor}
              </span>
            </Link>
          ))
        )}
      </section>
      {lista.length === LIMITE && <p className="text-xs text-brand-dark/60">Se muestran las {LIMITE} más recientes. Busca por paciente para ver otras.</p>}
    </>
  );
}
