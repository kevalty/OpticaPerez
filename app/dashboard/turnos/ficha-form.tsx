"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { OJOS, PARES, RX_CAMPOS } from "@/lib/ficha";
import { btnPrimary, inputCls } from "@/lib/ui";
import type { FormState } from "@/lib/validation";
import { RecetarioFields } from "./recetario-fields";

const small = `${inputCls} !min-h-11 !px-2 !py-1.5 !text-sm`;
const chip =
  "inline-flex min-h-11 cursor-pointer select-none items-center rounded-full border border-brand/20 bg-white px-4 py-2 text-sm font-semibold text-brand transition hover:bg-iris-light has-[:checked]:border-brand has-[:checked]:bg-brand has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-iris";
const addChip = "inline-flex min-h-11 items-center rounded-full border border-brand/20 bg-white px-4 py-2 text-sm font-semibold text-brand transition hover:bg-iris-light active:scale-95";
const cardCls = "rounded-2xl border border-brand/15 bg-white p-4";
const h4 = "mb-2 text-xs font-bold uppercase tracking-wide text-iris";

export type RxPrevio = { ojo: string; esfera: number | null; cilindro: number | null; eje: number | null; av: string | null; add: number | null; dp: number | null }[];

type Seccion = "obs" | "examen" | "rx" | "cl" | "lab" | "cierre";
const SECCIONES: { id: Seccion; titulo: string }[] = [
  { id: "obs", titulo: "Motivo y observaciones" },
  { id: "examen", titulo: "Examen" },
  { id: "rx", titulo: "Rx final" },
  { id: "cl", titulo: "Lente de contacto" },
  { id: "lab", titulo: "RX para el laboratorio" },
  { id: "cierre", titulo: "Certificado y cierre" },
];
const RAPIDA: Seccion[] = ["obs", "rx", "cierre"];

const FRASES_OBS = ["Cefalea", "Visión borrosa de lejos", "Visión borrosa de cerca", "Ardor / ojo seco", "Uso de computador", "Control anual"];
const FRASES_RECO = ["Uso permanente", "Solo para lectura", "Pausas visuales 20-20-20", "Lubricante ocular", "Control en 6 meses"];
const CIE = [
  ["H52.0", "Hipermetropía"],
  ["H52.1", "Miopía"],
  ["H52.2", "Astigmatismo"],
  ["H52.3", "Anisometropía"],
  ["H52.4", "Presbicia"],
] as const;
const AVH = ["SIN RX AO.", "CON RX AO.", "SIN RX OD.", "SIN RX OI."];

// Formulario de la ficha de la consulta. Todos los campos de la ficha siguen aqui; solo cambia como se muestran:
//  - "Consulta rapida": lo habitual en una pantalla (observaciones, Rx final, certificado y cierre).
//  - "Ficha completa": todas las secciones, de a una. Menu lateral en pantallas grandes, pasos arriba en tablet y celular.
// Todas las secciones permanecen en la pagina (solo se ocultan), por eso se guardan juntas con un solo boton.
export function FichaForm({
  action,
  prefill,
  rxPrevio,
  borradorKey,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  prefill: { rx_anterior_od?: string; rx_anterior_oi?: string };
  rxPrevio: RxPrevio;
  borradorKey: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as FormState);
  const form = useRef<HTMLFormElement>(null);
  const [modo, setModo] = useState<"rapida" | "completa">("rapida");
  const [activa, setActiva] = useState<Seccion>("examen");
  const [hechas, setHechas] = useState<Set<Seccion>>(new Set());
  const [guardado, setGuardado] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const key = `ficha_borrador_${borradorKey}`;

  const visible = (id: Seccion) => (modo === "rapida" ? RAPIDA.includes(id) : activa === id);
  const idx = SECCIONES.findIndex((s) => s.id === activa);
  const ir = (id: Seccion) => {
    setModo("completa");
    setActiva(id);
  };
  const paso = (d: number) => setActiva(SECCIONES[Math.min(SECCIONES.length - 1, Math.max(0, idx + d))].id);

  // ---- Borrador: se guarda solo (sessionStorage: se borra al cerrar la pestana) y se recupera tras un error o recarga ----
  function restaurar() {
    const f = form.current;
    if (!f) return;
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return;
      const { t, e } = JSON.parse(raw) as { t: number; e: [string, string][] };
      if (Date.now() - t > 12 * 3600_000) return sessionStorage.removeItem(key);
      const porNombre = new Map<string, string[]>();
      for (const [k, v] of e) porNombre.set(k, [...(porNombre.get(k) ?? []), v]);
      for (const el of Array.from(f.elements) as HTMLInputElement[]) {
        if (!el.name || !porNombre.has(el.name)) continue;
        const vals = porNombre.get(el.name)!;
        if (el.type === "checkbox" || el.type === "radio") el.checked = vals.includes(el.value);
        else el.value = vals[0];
      }
      // radios sin valor guardado (p. ej. "ninguno" = "") quedan como estaban
    } catch {}
  }
  useEffect(restaurar, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!state.error) return;
    // React vacia el formulario despues de una accion; se vuelve a llenar con el borrador (varias veces por si el vaciado llega tarde).
    const ts = [0, 80, 250, 600].map((ms) => setTimeout(restaurar, ms));
    return () => ts.forEach(clearTimeout);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  function alCambiar(e: React.FormEvent<HTMLFormElement>) {
    const sec = (e.target as HTMLElement).closest<HTMLElement>("[data-sec]")?.dataset.sec as Seccion | undefined;
    if (sec) setHechas((h) => (h.has(sec) ? h : new Set(h).add(sec)));
    clearTimeout(timer.current);
    timer.current = setTimeout(guardarBorrador, 700);
  }

  function guardarBorrador() {
    const f = form.current;
    if (!f) return;
    const e: [string, string][] = [];
    new FormData(f).forEach((v, k) => typeof v === "string" && !k.startsWith("$ACTION") && e.push([k, v]));
    try {
      sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), e }));
      setGuardado(true);
    } catch {}
  }

  // ---- Utilidades de llenado rapido ----
  const campo = (n: string) => form.current?.elements.namedItem(n) as HTMLInputElement | HTMLTextAreaElement | null;
  function poner(n: string, v: string) {
    const el = campo(n);
    if (!el) return;
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function agregarTexto(n: string, texto: string, sep = "\n") {
    const el = campo(n);
    if (!el) return;
    if (el.value.includes(texto)) return;
    poner(n, el.value.trim() ? `${el.value.trim()}${sep}${texto}` : texto);
  }
  function agregarCie(codigo: string, nombre: string) {
    for (const suf of ["od", "oi"]) {
      const el = campo(`cie_${suf}`);
      if (!el || el.value.includes(codigo)) continue;
      poner(`cie_${suf}`, el.value.trim() ? `${el.value.trim()} / ${codigo}` : codigo);
    }
    agregarTexto("observaciones", `Dx: ${nombre}`);
  }
  const copiarOD = () => {
    for (const c of RX_CAMPOS) poner(`rx_oi_${c.key}`, campo(`rx_od_${c.key}`)?.value ?? "");
  };
  const repetirAnterior = () => {
    for (const o of OJOS) {
      const r = rxPrevio.find((x) => x.ojo === o.id);
      if (!r) continue;
      for (const c of RX_CAMPOS) {
        const v = r[c.key as keyof typeof r];
        if (v != null && v !== "") poner(`rx_${o.suf}_${c.key}`, String(v));
      }
    }
  };
  const meses = (d: number) => {
    const actual = Number(campo("control_meses")?.value) || 0;
    poner("control_meses", String(Math.min(60, Math.max(1, (actual || 12) + d))));
  };

  const ocultar = (id: Seccion) => (visible(id) ? "" : "hidden");
  const columna = (id: Seccion) =>
    modo === "rapida" ? (id === "cierre" ? "lg:col-start-2 lg:row-start-1 lg:row-span-2" : "lg:col-start-1") : "";

  return (
    <form
      ref={form}
      action={formAction}
      noValidate
      onSubmit={guardarBorrador}
      onInput={alCambiar}
      onChange={alCambiar}
      onKeyDown={(e) => {
        if (modo === "completa" && e.altKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
          e.preventDefault();
          paso(e.key === "ArrowRight" ? 1 : -1);
        }
      }}
      className="flex flex-col gap-4"
    >
      {/* Modo */}
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Tipo de ficha" className="inline-flex rounded-xl bg-iris-light/60 p-1">
          {([["rapida", "⚡ Consulta rápida"], ["completa", "Ficha completa"]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={modo === id} onClick={() => setModo(id)} className={`min-h-11 rounded-lg px-4 text-sm font-semibold ${modo === id ? "bg-brand text-white shadow" : "text-brand hover:bg-white/70"}`}>
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-brand-dark/60">
          {modo === "rapida" ? "Lo habitual en una pantalla. Todo lo demás está en «Ficha completa»." : "Avanza con Siguiente, o toca una sección. Alt + ← / → cambia de sección."}
        </p>
      </div>

      <div className={modo === "completa" ? "lg:grid lg:grid-cols-[14rem_1fr] lg:gap-5" : ""}>
        {modo === "completa" && (
          <nav aria-label="Secciones de la ficha" className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1 lg:mb-0 lg:flex-col lg:overflow-visible">
            {SECCIONES.map((s, i) => {
              const hecha = hechas.has(s.id) && activa !== s.id;
              return (
                <button key={s.id} type="button" onClick={() => setActiva(s.id)} aria-current={activa === s.id ? "step" : undefined} className={`flex min-h-12 shrink-0 items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm font-semibold ${activa === s.id ? "border-brand bg-white text-brand shadow" : hecha ? "border-transparent text-emerald-700" : "border-transparent text-brand-dark/60 hover:bg-iris-light/50"}`}>
                  <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs ${activa === s.id ? "bg-brand text-white" : hecha ? "bg-emerald-600 text-white" : "bg-iris-light text-brand"}`}>{hecha ? "✓" : i + 1}</span>
                  <span className="whitespace-nowrap lg:whitespace-normal">{s.titulo}</span>
                </button>
              );
            })}
            <div className="mt-auto hidden pt-3 text-xs text-brand-dark/60 lg:block">
              Completadas {SECCIONES.filter((s) => hechas.has(s.id)).length} de {SECCIONES.length}
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-iris-light">
                <div className="h-full rounded-full bg-iris transition-all" style={{ width: `${(SECCIONES.filter((s) => hechas.has(s.id)).length / SECCIONES.length) * 100}%` }} />
              </div>
            </div>
          </nav>
        )}

        <div className={modo === "rapida" ? "grid items-start gap-4 lg:grid-cols-[1.25fr_1fr] lg:grid-rows-[auto_1fr]" : "min-w-0"}>
          {/* ---- Observaciones ---- */}
          <section data-sec="obs" className={`${ocultar("obs")} ${columna("obs")} ${cardCls}`}>
            <h4 className={h4}>Motivo y observaciones</h4>
            <textarea name="observaciones" rows={3} maxLength={5000} placeholder="Motivo de consulta, molestias, antecedentes…" className={inputCls} />
            <div className="mt-2 flex flex-wrap gap-2">
              {FRASES_OBS.map((f) => (
                <button key={f} type="button" onClick={() => agregarTexto("observaciones", f)} className={addChip}>+ {f}</button>
              ))}
            </div>
          </section>

          {/* ---- Examen ---- */}
          <section data-sec="examen" className={`${ocultar("examen")} ${columna("examen")} flex flex-col gap-3`}>
            <div className={cardCls}>
              <h4 className={h4}>Agudeza visual y datos base</h4>
              <TablaPares keys={PARES.slice(0, 5).map((p) => p.key)} prefill={prefill} />
            </div>
            <details className="rounded-2xl border border-brand/15 bg-white">
              <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-brand">
                Más pruebas <span className="font-normal text-brand-dark/60">queratometría, oftalmoscopia, retinoscopia, lectura de computador</span>
              </summary>
              <div className="px-4 pb-4">
                <TablaPares keys={PARES.slice(5).map((p) => p.key)} prefill={prefill} />
              </div>
            </details>
          </section>

          {/* ---- Rx final ---- */}
          <section data-sec="rx" className={`${ocultar("rx")} ${columna("rx")} ${cardCls}`}>
            <h4 className={h4}>Rx final</h4>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] border-separate border-spacing-y-1.5 text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-brand-dark/50">
                    <th className="px-1 font-medium"></th>
                    {RX_CAMPOS.map((c) => (
                      <th key={c.key} className="px-1 font-medium">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {OJOS.map((o) => (
                    <tr key={o.id}>
                      <th className="pr-2 font-bold text-brand">{o.id}</th>
                      {RX_CAMPOS.map((c) => (
                        <td key={c.key} className="px-1">
                          {"text" in c ? (
                            <input name={`rx_${o.suf}_${c.key}`} maxLength={30} aria-label={`${c.label} ${o.id}`} className={small} />
                          ) : (
                            <input name={`rx_${o.suf}_${c.key}`} type="number" inputMode="decimal" step={c.step} aria-label={`${c.label} ${o.id}`} className={small} />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <button type="button" onClick={copiarOD} className={addChip}>⇄ OI igual al OD</button>
              <button type="button" onClick={repetirAnterior} disabled={rxPrevio.length === 0} className={`${addChip} disabled:opacity-40`}>↺ Repetir Rx anterior</button>
              <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs font-medium text-brand">
                Color de lente
                <input name="color" maxLength={60} placeholder="Ej. fotocromático" className={small} />
              </label>
              <label className={chip}>
                <input type="checkbox" name="bifocal" className="sr-only" />
                Bifocal
              </label>
            </div>
          </section>

          {/* ---- Lente de contacto ---- */}
          <section data-sec="cl" className={`${ocultar("cl")} ${columna("cl")} ${cardCls}`}>
            <h4 className={h4}>Lente de contacto</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {OJOS.map((o) => (
                <div key={o.id} className="flex flex-col gap-2 rounded-xl bg-iris-light/40 p-3">
                  <p className="text-sm font-bold text-brand">{o.label}</p>
                  <input name={`cl_${o.suf}_prueba`} placeholder="Prueba" maxLength={200} aria-label={`Prueba ${o.id}`} className={small} />
                  <input name={`cl_${o.suf}_av`} placeholder="A.V." maxLength={30} aria-label={`A.V. lente de contacto ${o.id}`} className={small} />
                </div>
              ))}
            </div>
          </section>

          {/* ---- RX para el laboratorio ---- */}
          <section data-sec="lab" className={`${ocultar("lab")} ${columna("lab")} flex flex-col gap-3`}>
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-brand">
              Hoja <b>RX</b> para el laboratorio (formato Essilor). Es <b>opcional</b>. Si dejas las medidas vacías, al imprimir se toman de la <b>Rx final</b>.
            </p>
            <RecetarioFields />
          </section>

          {/* ---- Certificado y cierre ---- */}
          <section data-sec="cierre" className={`${ocultar("cierre")} ${columna("cierre")} flex flex-col gap-3`}>
            <div className={cardCls}>
              <h4 className={h4}>Datos para el certificado</h4>
              <p className="mb-1 text-xs font-semibold text-brand">A.V. habitual</p>
              <div className="flex flex-wrap gap-2">
                <label className={chip}><input type="radio" name="avh_condicion" value="" defaultChecked className="sr-only" />Ninguna</label>
                {AVH.map((a) => (
                  <label key={a} className={chip}><input type="radio" name="avh_condicion" value={a} className="sr-only" />{a}</label>
                ))}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1 text-xs font-medium text-brand">A.V. habitual OD<input name="avh_od" maxLength={30} placeholder="20/100" className={small} /></label>
                <label className="flex flex-col gap-1 text-xs font-medium text-brand">A.V. habitual OI<input name="avh_oi" maxLength={30} placeholder="20/200" className={small} /></label>
                <label className="flex flex-col gap-1 text-xs font-medium text-brand">Tipo de Rx<input name="rx_tipo" maxLength={30} defaultValue="FINAL" className={small} /></label>
              </div>

              <p className="mb-1 mt-4 text-xs font-semibold text-brand">Diagnóstico · código CIE <span className="font-normal text-brand-dark/60">(un toque lo escribe en ambos ojos)</span></p>
              <div className="flex flex-wrap gap-2">
                {CIE.map(([c, n]) => (
                  <button key={c} type="button" onClick={() => agregarCie(c, n)} className={addChip}>{c} {n}</button>
                ))}
              </div>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs font-medium text-brand">Código CIE — OD<input name="cie_od" maxLength={60} placeholder="H52.1 / H52.2" className={small} /></label>
                <label className="flex flex-col gap-1 text-xs font-medium text-brand">Código CIE — OI<input name="cie_oi" maxLength={60} placeholder="H52.1 / H52.2" className={small} /></label>
              </div>

              <div className="mt-4 flex flex-col gap-4">
                <div>
                  <p className="mb-1 text-xs font-semibold text-brand">Test de colores</p>
                  <div className="flex flex-wrap gap-2">
                    <label className={chip}><input type="radio" name="test_colores" value="" defaultChecked className="sr-only" />—</label>
                    <label className={chip}><input type="radio" name="test_colores" value="NORMAL" className="sr-only" />Normal</label>
                    <label className={chip}><input type="radio" name="test_colores" value="ANORMAL" className="sr-only" />Anormal</label>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-brand">Lentes correctores</p>
                  <div className="flex flex-wrap gap-2">
                    <label className={chip}><input type="radio" name="necesita_lentes" value="" defaultChecked className="sr-only" />—</label>
                    <label className={chip}><input type="radio" name="necesita_lentes" value="si" className="sr-only" />Sí necesita</label>
                    <label className={chip}><input type="radio" name="necesita_lentes" value="no" className="sr-only" />No necesita</label>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-brand">Control cada (meses)</p>
                  <div className="inline-flex items-center overflow-hidden rounded-xl border border-brand/20">
                    <button type="button" onClick={() => meses(-1)} aria-label="Menos un mes" className="size-11 bg-iris-light/50 text-xl text-brand hover:bg-iris-light">−</button>
                    <input name="control_meses" type="number" inputMode="numeric" step="1" defaultValue="12" aria-label="Meses para el control" className="h-11 w-16 border-0 text-center text-base outline-none" />
                    <button type="button" onClick={() => meses(1)} aria-label="Más un mes" className="size-11 bg-iris-light/50 text-xl text-brand hover:bg-iris-light">＋</button>
                  </div>
                  <button type="button" onClick={() => poner("control_meses", "")} className="ml-2 text-xs text-iris hover:underline">quitar</button>
                </div>
              </div>
            </div>

            <div className={cardCls}>
              <h4 className={h4}>Recomendaciones</h4>
              <div className="mb-2 flex flex-wrap gap-2">
                {FRASES_RECO.map((f) => (
                  <button key={f} type="button" onClick={() => agregarTexto("recomendaciones", f)} className={addChip}>+ {f}</button>
                ))}
              </div>
              <textarea name="recomendaciones" rows={2} maxLength={5000} placeholder="Otras recomendaciones…" className={inputCls} />
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-700">Indicaciones para recepción</h4>
              <p className="mb-2 text-xs text-brand-dark/70">Esto SÍ lo verá la recepcionista (junto con el certificado y la RX). No escribas aquí datos clínicos privados.</p>
              <textarea name="indicaciones_recepcion" rows={2} maxLength={2000} className={inputCls} />
            </div>
          </section>
        </div>
      </div>

      {modo === "rapida" && (
        <p className="text-sm text-brand-dark/70">
          ¿Algo más? Abre:{" "}
          {([["examen", "Examen y más pruebas"], ["cl", "Lente de contacto"], ["lab", "RX para el laboratorio"]] as const).map(([id, t], i) => (
            <span key={id}>
              {i > 0 && " · "}
              <button type="button" onClick={() => ir(id)} className="font-semibold text-iris hover:underline">{t}</button>
            </span>
          ))}
        </p>
      )}

      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      {/* Barra de acciones siempre a la vista */}
      <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap items-center gap-3 border-t border-brand/10 bg-white/95 px-5 py-3 backdrop-blur sm:-mx-7 sm:-mb-7 sm:px-7">
        <span className={`text-xs font-semibold ${guardado ? "text-emerald-700" : "text-brand-dark/50"}`}>{guardado ? "● Borrador guardado" : "○ Borrador automático"}</span>
        <span className="hidden text-xs text-brand-dark/60 md:inline">
          <kbd className="rounded bg-iris-light px-1">Ctrl</kbd>+<kbd className="rounded bg-iris-light px-1">Enter</kbd> guarda
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          {modo === "completa" && idx > 0 && (
            <button type="button" onClick={() => paso(-1)} className="min-h-12 rounded-xl border border-brand/20 px-5 font-semibold text-brand hover:bg-iris-light">← Atrás</button>
          )}
          {modo === "completa" && idx < SECCIONES.length - 1 && (
            <button type="button" onClick={() => paso(1)} className="min-h-12 rounded-xl border border-brand bg-white px-5 font-semibold text-brand hover:bg-iris-light">Siguiente →</button>
          )}
          <button type="submit" disabled={pending} className={`${btnPrimary} !min-h-12 !px-6 text-base`}>
            {pending ? "Guardando…" : "Guardar ficha y terminar consulta"}
          </button>
        </div>
      </div>
    </form>
  );
}

function TablaPares({ keys, prefill }: { keys: string[]; prefill: { rx_anterior_od?: string; rx_anterior_oi?: string } }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[26rem] border-separate border-spacing-y-1.5 text-left text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-brand-dark/50">
            <th className="px-1 font-medium"></th>
            <th className="px-1 font-medium">OD (derecho)</th>
            <th className="px-1 font-medium">OI (izquierdo)</th>
          </tr>
        </thead>
        <tbody>
          {PARES.filter((p) => keys.includes(p.key)).map((p) => (
            <tr key={p.key}>
              <th className="whitespace-nowrap pr-3 font-bold text-brand">{p.label}</th>
              {OJOS.map((o) => (
                <td key={o.id} className="px-1">
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
  );
}
