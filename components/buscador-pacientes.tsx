"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { buscarPacientes } from "@/app/dashboard/pacientes/actions";
import { LIMITE_PACIENTES, type PacienteFila } from "@/lib/pacientes";
import { btnGhost, card, inputCls } from "@/lib/ui";

// Buscador + lista de pacientes. Lo que se escribe NO va a la URL (cedula, nombre y celular son datos personales):
// se consulta con una accion del servidor y el resultado vive solo en esta pagina.
export function BuscadorPacientes({
  inicial,
  hrefBase,
  seleccionadoId,
  autoFocus = true,
}: {
  inicial: PacienteFila[];
  hrefBase: string; // el id del paciente se agrega al final, p. ej. "/dashboard/pacientes/"
  seleccionadoId?: string | null;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [lista, setLista] = useState(inicial);
  const [buscando, startTransition] = useTransition();
  const ultima = useRef(0);

  function buscar(texto: string) {
    const turno = ++ultima.current;
    startTransition(async () => {
      const r = await buscarPacientes(texto);
      if (turno === ultima.current) setLista(r); // ignora respuestas viejas
    });
  }

  // Busca mientras se escribe (con una pausa corta), sin recargar la pagina.
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
          placeholder="Buscar por nombre, cédula o celular"
          maxLength={60}
          autoComplete="off"
          autoFocus={autoFocus}
          aria-label="Buscar paciente"
          className={inputCls}
        />
        <button className={btnGhost}>Buscar</button>
      </form>

      <section data-lista aria-busy={buscando} className={`${card} divide-y divide-brand/10 p-0 ${buscando ? "opacity-70" : ""}`}>
        {lista.length === 0 ? (
          <p className="p-5 text-sm text-brand-dark/70">{q ? "No se encontró ningún paciente." : "Aún no hay pacientes registrados."}</p>
        ) : (
          lista.map((p) => (
            <Link
              key={p.id}
              href={`${hrefBase}${p.id}`}
              className={`flex min-h-12 items-center justify-between gap-3 px-5 py-3 outline-none hover:bg-iris-light/50 focus-visible:bg-iris-light ${p.id === seleccionadoId ? "bg-iris-light/60" : ""}`}
            >
              <span className="font-medium text-brand">{p.nombre}</span>
              <span className="text-right text-xs text-brand-dark/60 sm:text-sm">
                {[p.documento, p.telefono, p.edad != null ? `${p.edad} años` : null].filter(Boolean).join(" · ")}
              </span>
            </Link>
          ))
        )}
      </section>
      {lista.length === LIMITE_PACIENTES && (
        <p className="text-xs text-brand-dark/60">Se muestran los primeros {LIMITE_PACIENTES}. Afina la búsqueda para ver otros.</p>
      )}
    </>
  );
}
