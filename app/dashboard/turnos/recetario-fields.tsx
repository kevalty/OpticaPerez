"use client";

import { useRef, useState } from "react";
import { DISENOS, EXTERIORES, MATERIALES, REC_COLUMNAS, REC_OJOS, TRATAMIENTOS, campo, type Prefijo } from "@/lib/recetario";
import { btnGhost, inputCls } from "@/lib/ui";

const small = `${inputCls} !px-2 !py-1.5 !text-sm`;
const chip =
  "inline-flex min-h-10 cursor-pointer select-none items-center rounded-full border border-brand/20 px-3 py-1.5 text-sm text-brand transition hover:bg-iris-light has-[:checked]:border-brand has-[:checked]:bg-brand has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-iris";

function Chips({ type, name, opciones, otro, conNinguno }: { type: "radio" | "checkbox"; name: string; opciones: { id: string; label: string }[]; otro?: string; conNinguno?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {conNinguno && (
        <label className={chip}>
          <input type="radio" name={name} value="" defaultChecked className="sr-only" />
          Ninguno
        </label>
      )}
      {opciones.map((o) => (
        <label key={o.id} className={chip}>
          <input type={type} name={name} value={o.id} className="sr-only" />
          {o.label}
        </label>
      ))}
      <label className={chip}>
        <input type={type} name={name} value="otro" className="sr-only" />
        Otro
      </label>
      {otro && <input name={otro} maxLength={60} placeholder="Especifica…" aria-label="Otro, especifica" className={`${small} w-44`} />}
    </div>
  );
}

function Bloque({ pre, titulo }: { pre: Prefijo; titulo: string }) {
  const segundo = pre === "s";
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-iris-light/40 p-3 sm:p-4">
      <h5 className="font-semibold text-brand">{titulo}</h5>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-brand-dark/50">
              <th className="py-1 pr-2 font-medium">Ojo</th>
              {REC_COLUMNAS.map((c) => (
                <th key={c.key} className="py-1 pr-2 font-medium">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {REC_OJOS.map((o) => (
              <tr key={o.id}>
                <th className="py-1 pr-2 font-medium text-brand">{o.id}</th>
                {REC_COLUMNAS.map((c) => (
                  <td key={c.key} className="py-1 pr-2">
                    <input
                      name={campo(pre, o.suf, c.key)}
                      maxLength={12}
                      inputMode="text"
                      aria-label={`${c.label} ${o.id}${segundo ? " segundo par" : ""}`}
                      className={`${small} min-w-16`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-brand">Diseño</p>
          <Chips type="radio" name={campo(pre, "diseno")} opciones={segundo ? DISENOS : DISENOS.slice(0, 2)} conNinguno />
          <input name={campo(pre, "diseno_detalle")} maxLength={60} placeholder="Detalle del diseño (opcional)" aria-label="Detalle del diseño" className={`${small} max-w-sm`} />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-brand">Tratamiento</p>
          <Chips type="checkbox" name={campo(pre, "trat")} opciones={segundo ? TRATAMIENTOS.filter((t) => t.id !== "xperio") : TRATAMIENTOS} otro={campo(pre, "trat_otro")} />
        </div>
        {segundo && (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-brand">Para exteriores</p>
            <Chips type="checkbox" name={campo(pre, "ext")} opciones={EXTERIORES} otro={campo(pre, "ext_detalle")} />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-brand">Material</p>
          <Chips type="radio" name={campo(pre, "mat")} opciones={MATERIALES} otro={campo(pre, "mat_otro")} conNinguno />
        </div>
      </div>
    </section>
  );
}

// Recetario de lentes (formato Essilor). Opcional: si no se llena, no se guarda.
export function RecetarioFields() {
  const raiz = useRef<HTMLDivElement>(null);
  const [segundo, setSegundo] = useState(false);

  // Copia la tabla Rx de la ficha (esfera, cilindro, eje, add y D.P.) al recetario para no escribirla dos veces.
  function copiarRx() {
    const form = raiz.current?.closest("form");
    if (!form) return;
    const val = (n: string) => (form.elements.namedItem(n) as HTMLInputElement | null)?.value ?? "";
    const pon = (n: string, v: string) => {
      const el = form.elements.namedItem(n) as HTMLInputElement | null;
      if (el && v !== "") el.value = v;
    };
    const signo = (v: string) => (v !== "" && Number(v) > 0 ? `+${Number(v).toFixed(2)}` : v !== "" ? Number(v).toFixed(2) : "");
    for (const o of REC_OJOS) {
      pon(campo("p", o.suf, "esfera"), signo(val(`rx_${o.suf}_esfera`)));
      pon(campo("p", o.suf, "cilindro"), signo(val(`rx_${o.suf}_cilindro`)));
      pon(campo("p", o.suf, "eje"), val(`rx_${o.suf}_eje`));
      pon(campo("p", o.suf, "adicion"), signo(val(`rx_${o.suf}_add`)));
      pon(campo("p", o.suf, "dp_lejos"), val(`rx_${o.suf}_dp`));
    }
  }

  return (
    <div ref={raiz} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-brand">
          Fecha de entrega
          <input type="date" name="rec_fecha_entrega" className={`${small} w-44`} />
        </label>
        <button type="button" onClick={copiarRx} className={btnGhost}>
          Copiar Rx de la ficha
        </button>
      </div>

      <Bloque pre="p" titulo="Prescripción primaria" />

      <label className="flex items-center gap-2 text-sm font-medium text-brand">
        <input type="checkbox" checked={segundo} onChange={(e) => setSegundo(e.target.checked)} className="size-4 accent-[#262d7a]" />
        Agregar segundo par
      </label>
      {/* disabled: si se desmarca, lo escrito en el segundo par no se envia */}
      <fieldset disabled={!segundo} hidden={!segundo} className="contents">
        <Bloque pre="s" titulo="Segundo par" />
      </fieldset>
    </div>
  );
}
