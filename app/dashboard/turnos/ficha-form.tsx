"use client";

import { useActionState } from "react";
import { OJOS, PARES, RX_CAMPOS } from "@/lib/ficha";
import { btnPrimary, inputCls } from "@/lib/ui";
import { RecetarioFields } from "./recetario-fields";
import type { FormState } from "@/lib/validation";

const small = `${inputCls} !px-2 !py-1.5 !text-sm`;

// Formulario de la ficha medica de la consulta actual (equivale a la ficha en papel de Optica Perez).
export function FichaForm({
  action,
  prefill,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  prefill: { rx_anterior_od?: string; rx_anterior_oi?: string };
}) {
  const [state, formAction, pending] = useActionState(action, {} as FormState);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <label className="flex flex-col gap-1 text-sm font-medium text-brand">
        Observaciones generales
        <textarea name="observaciones" rows={3} maxLength={5000} className={inputCls} />
      </label>

      <section>
        <h4 className="mb-2 font-semibold text-brand">Medidas</h4>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-brand-dark/50">
                <th className="py-1 pr-3 font-medium"></th>
                <th className="py-1 pr-3 font-medium">OD (derecho)</th>
                <th className="py-1 font-medium">OI (izquierdo)</th>
              </tr>
            </thead>
            <tbody>
              {PARES.map((p) => (
                <tr key={p.key}>
                  <th className="py-1 pr-3 font-medium text-brand">{p.label}</th>
                  {OJOS.map((o) => (
                    <td key={o.id} className="py-1 pr-3">
                      <input
                        name={`${p.key}_${o.suf}`}
                        maxLength={200}
                        defaultValue={p.key === "rx_anterior" ? (prefill[`rx_anterior_${o.suf}`] ?? "") : ""}
                        aria-label={`${p.label} ${o.id}`}
                        className={small}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h4 className="mb-2 font-semibold text-brand">Rx (receta)</h4>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-brand-dark/50">
                <th className="py-1 pr-3 font-medium">Ojo</th>
                {RX_CAMPOS.map((c) => (
                  <th key={c.key} className="py-1 pr-2 font-medium">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {OJOS.map((o) => (
                <tr key={o.id}>
                  <th className="py-1 pr-3 font-medium text-brand">{o.id}</th>
                  {RX_CAMPOS.map((c) => (
                    <td key={c.key} className="py-1 pr-2">
                      {"text" in c ? (
                        <input name={`rx_${o.suf}_${c.key}`} maxLength={30} aria-label={`${c.label} ${o.id}`} className={small} />
                      ) : (
                        <input
                          name={`rx_${o.suf}_${c.key}`}
                          type="number"
                          step={c.step}
                          min={c.min}
                          max={c.max}
                          aria-label={`${c.label} ${o.id}`}
                          className={small}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-brand">
            Color de lente
            <input name="color" maxLength={60} className={`${small} w-48`} />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm font-medium text-brand">
            <input type="checkbox" name="bifocal" className="size-4 accent-[#262d7a]" />
            Bifocal
          </label>
        </div>
      </section>

      <section>
        <h4 className="mb-2 font-semibold text-brand">Lente de contacto</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          {OJOS.map((o) => (
            <div key={o.id} className="flex flex-col gap-2 rounded-xl bg-iris-light/40 p-3">
              <p className="text-sm font-medium text-brand">{o.label}</p>
              <input name={`cl_${o.suf}_prueba`} placeholder="Prueba" maxLength={200} aria-label={`Prueba ${o.id}`} className={small} />
              <input name={`cl_${o.suf}_av`} placeholder="A.V." maxLength={30} aria-label={`A.V. lente de contacto ${o.id}`} className={small} />
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h4 className="font-semibold text-brand">Recetario de lentes</h4>
          <p className="text-xs text-brand-dark/70">
            La hoja que se envía al laboratorio (formato Essilor). Es opcional: si el paciente no necesita lentes, déjala vacía.
          </p>
        </div>
        <RecetarioFields />
      </section>

      <section className="flex flex-col gap-4 rounded-xl bg-iris-light/40 p-4">
        <div>
          <h4 className="font-semibold text-brand">Datos para el certificado</h4>
          <p className="text-xs text-brand-dark/70">Lo que se imprime en el certificado que recibe el paciente. Lo que dejes vacío no se imprime.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-brand">
            A.V. habitual (condición)
            <input name="avh_condicion" list="avh-opciones" maxLength={60} placeholder="SIN RX AO." className={small} />
            <datalist id="avh-opciones">
              <option value="SIN RX AO." />
              <option value="CON RX AO." />
              <option value="SIN RX OD." />
              <option value="SIN RX OI." />
            </datalist>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-brand">
            A.V. habitual OD
            <input name="avh_od" maxLength={30} placeholder="20/100" className={small} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-brand">
            A.V. habitual OI
            <input name="avh_oi" maxLength={30} placeholder="20/200" className={small} />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-brand">
            Tipo de Rx
            <input name="rx_tipo" maxLength={30} defaultValue="FINAL" className={small} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-brand">
            Código CIE — OD
            <input name="cie_od" list="cie-opciones" maxLength={60} placeholder="H52.1 / H52.2" className={small} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-brand">
            Código CIE — OI
            <input name="cie_oi" list="cie-opciones" maxLength={60} placeholder="H52.1 / H52.2" className={small} />
          </label>
          <datalist id="cie-opciones">
            <option value="H52.0" label="Hipermetropía" />
            <option value="H52.1" label="Miopía" />
            <option value="H52.2" label="Astigmatismo" />
            <option value="H52.3" label="Anisometropía y aniseiconia" />
            <option value="H52.4" label="Presbicia" />
            <option value="H52.5" label="Trastornos de la acomodación" />
            <option value="H52.6" label="Otros trastornos de la refracción" />
            <option value="H52.7" label="Trastorno de la refracción, no especificado" />
          </datalist>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-brand">
            Test de colores
            <select name="test_colores" defaultValue="" className={small}>
              <option value="">No se imprime</option>
              <option value="NORMAL">NORMAL</option>
              <option value="ANORMAL">ANORMAL</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-brand">
            Lentes correctores
            <select name="necesita_lentes" defaultValue="" className={small}>
              <option value="">No se imprime</option>
              <option value="si">Necesita usar lentes correctores</option>
              <option value="no">No necesita lentes correctores</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-brand">
            Control cada (meses)
            <input name="control_meses" type="number" min={1} max={60} step={1} placeholder="8" className={small} />
          </label>
        </div>
      </section>

      <label className="flex flex-col gap-1 text-sm font-medium text-brand">
        Recomendaciones
        <textarea name="recomendaciones" rows={3} maxLength={5000} className={inputCls} />
      </label>

      <label className="flex flex-col gap-1 rounded-xl bg-amber-50 p-3 text-sm font-medium text-brand">
        Indicaciones para recepción
        <span className="text-xs font-normal text-brand-dark/70">
          Esto SÍ lo verá la recepcionista (junto con la tabla Rx) para imprimir la receta y cobrar o dar instrucciones. No
          escribas aquí datos clínicos privados.
        </span>
        <textarea name="indicaciones_recepcion" rows={2} maxLength={2000} className={inputCls} />
      </label>

      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Guardando…" : "Guardar ficha y terminar consulta"}
        </button>
        <p className="text-xs text-brand-dark/60">
          Al guardar, el turno pasa a “Atendido” y recepción lo ve de inmediato. Atajo: <kbd className="rounded bg-iris-light px-1">Ctrl</kbd>+<kbd className="rounded bg-iris-light px-1">Enter</kbd>
        </p>
      </div>
    </form>
  );
}
