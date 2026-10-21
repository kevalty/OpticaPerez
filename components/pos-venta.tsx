"use client";

import { Miniatura } from "@/components/miniatura";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { crearVenta } from "@/app/dashboard/ventas/actions";
import { buscarPacientes } from "@/app/dashboard/pacientes/actions";
import type { PacienteFila } from "@/lib/pacientes";
import { btnGhost, btnPrimary, card, inputCls } from "@/lib/ui";
import {
  METODOS,
  MAX_DESCUENTO_RECEPCION,
  TIPOS_PRODUCTO,
  calcular,
  dinero,
  redondear,
  tipoLabel,
  type DescuentoGlobal,
  type Linea,
  type Metodo,
  type Producto,
} from "@/lib/ventas";

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
type PagoModo = "total" | "mitad" | "ninguno" | "otro";

// Pantalla de venta pensada para la recepcionista: todo en una sola pagina y manejable con teclado.
//   /  busca producto · Enter agrega el primero · Ctrl+Enter registra la venta
export function PosVenta({
  productos,
  pacienteInicial,
  esAdmin,
  entregaSugerida,
}: {
  productos: Producto[];
  pacienteInicial: { id: string; nombre: string; documento: string | null } | null;
  esAdmin: boolean;
  entregaSugerida: string;
}) {
  const [paciente, setPaciente] = useState(pacienteInicial);
  const [qPac, setQPac] = useState("");
  const [resPac, setResPac] = useState<PacienteFila[]>([]);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<string>("todos");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [desc, setDesc] = useState<DescuentoGlobal>({ tipo: "porcentaje", valor: 0 });
  const [pagoModo, setPagoModo] = useState<PagoModo>("total");
  const [pagoOtro, setPagoOtro] = useState("");
  const metodoGuardado = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return localStorage.getItem("pos_metodo");
      } catch {
        return null;
      }
    },
    () => null,
  );
  const [metodoElegido, setMetodoElegido] = useState<Metodo | null>(null);
  const metodo = (metodoElegido ?? (METODOS.some((m) => m.id === metodoGuardado) ? (metodoGuardado as Metodo) : "efectivo")) as Metodo;
  function elegirMetodo(m: Metodo) {
    setMetodoElegido(m);
    try {
      localStorage.setItem("pos_metodo", m); // se recuerda el ultimo metodo usado
    } catch {}
  }
  const [ordenManual, setOrdenManual] = useState<boolean | null>(null);
  const [entrega, setEntrega] = useState(entregaSugerida);
  const [notas, setNotas] = useState("");
  const [obs, setObs] = useState("");
  const [fallo, setFallo] = useState<{ texto: string; clave: string } | null>(null);
  const [enviando, startEnvio] = useTransition();
  const [, startBusqueda] = useTransition();
  const ultimaBusqueda = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);

  // ---- Paciente (busqueda por accion del servidor: lo escrito no va a la URL) ----
  useEffect(() => {
    if (qPac.trim().length < 2) return;
    const id = setTimeout(() => {
      const n = ++ultimaBusqueda.current;
      startBusqueda(async () => {
        const r = await buscarPacientes(qPac);
        if (n === ultimaBusqueda.current) setResPac(r.slice(0, 6));
      });
    }, 250);
    return () => clearTimeout(id);
  }, [qPac]);

  // ---- Productos ----
  const filtrados = useMemo(() => {
    const t = norm(q.trim());
    return productos
      .filter((p) => (tipo === "todos" || p.tipo === tipo) && (t === "" || norm(p.nombre).includes(t) || (p.codigo ? norm(p.codigo).includes(t) : false)))
      .slice(0, 8);
  }, [productos, q, tipo]);

  function agregar(p: Producto) {
    if (p.controla_stock && p.stock < 1) return;
    setLineas((ls) => {
      const i = ls.findIndex((l) => l.product_id === p.id);
      if (i >= 0) {
        const l = ls[i];
        const max = l.controla_stock ? l.stock : 999;
        return ls.map((x, j) => (j === i ? { ...x, cantidad: Math.min(max, x.cantidad + 1) } : x));
      }
      return [...ls, { product_id: p.id, nombre: p.nombre, tipo: p.tipo, precio: p.precio, cantidad: 1, descuento_pct: 0, stock: p.stock, controla_stock: p.controla_stock, tiene_foto: Boolean(p.tiene_foto) }];
    });
  }
  const cambiar = (id: string, parche: Partial<Linea>) => setLineas((ls) => ls.map((l) => (l.product_id === id ? { ...l, ...parche } : l)));
  const quitar = (id: string) => setLineas((ls) => ls.filter((l) => l.product_id !== id));

  // ---- Totales y cobro ----
  const t = calcular(lineas, desc);
  const hayLente = lineas.some((l) => l.tipo === "lente");
  const conOrden = ordenManual ?? (hayLente && paciente != null);
  const pago =
    pagoModo === "total" ? t.total : pagoModo === "mitad" ? redondear(t.total / 2) : pagoModo === "ninguno" ? 0 : redondear(Number(pagoOtro.replace(",", ".")) || 0);
  const excede = pago > t.total + 0.004;
  const saldo = Math.max(0, redondear(t.total - pago));
  const clave = JSON.stringify([lineas, desc, pagoModo, pagoOtro, conOrden, paciente?.id ?? null, entrega]);
  const error = fallo && fallo.clave === clave ? fallo.texto : null; // un aviso viejo se borra al corregir
  const setError = (texto: string | null) => setFallo(texto ? { texto, clave } : null);
  const pasaLimite = esAdmin || t.pctTotal <= MAX_DESCUENTO_RECEPCION + 1e-9;

  function enviar() {
    setError(null);
    if (lineas.length === 0) return setError("Agrega al menos un producto.");
    if (t.invalido) return setError("El descuento no puede superar el subtotal.");
    if (!pasaLimite) return setError(`Descuentos de más de ${MAX_DESCUENTO_RECEPCION} % necesitan autorización del administrador.`);
    if (conOrden && !paciente) return setError("Para generar la orden de trabajo elige un paciente.");
    if (pago < 0 || pago > t.total) return setError("El pago no puede ser mayor que el total.");
    startEnvio(async () => {
      const r = await crearVenta({
        patient_id: paciente?.id ?? null,
        observaciones: obs.trim() || null,
        items: lineas.map((l) => ({ product_id: l.product_id, cantidad: l.cantidad, descuento_pct: l.descuento_pct })),
        descuento: desc.valor > 0 ? desc : null,
        pago: pago > 0 ? { monto: pago, metodo } : null,
        orden: conOrden ? { fecha_entrega: entrega || null, notas: notas.trim() || null } : null,
      });
      if (r?.error) setError(r.error); // si sale bien, la accion redirige al detalle de la venta
    });
  }

  const enviarRef = useRef<() => void>(() => {});
  useEffect(() => {
    enviarRef.current = enviar;
  });
  // Ctrl+Enter registra la venta desde cualquier parte de la pagina.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Enter" || e.code === "Enter" || e.code === "NumpadEnter") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        enviarRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);


  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        enviar();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && (e.target as HTMLElement).tagName === "INPUT") {
          e.preventDefault(); // Enter dentro de un campo no registra la venta por accidente
        }
      }}
      className="grid gap-5 lg:grid-cols-[1fr_22rem] lg:items-start"
    >
      <div className="flex min-w-0 flex-col gap-5">
        {/* 1. Paciente */}
        <section className={`${card} flex flex-col gap-2`}>
          <h2 className="font-semibold text-brand">1. Paciente</h2>
          {paciente ? (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-iris-light/60 px-4 py-3">
              <div>
                <p className="font-medium text-brand">{paciente.nombre}</p>
                {paciente.documento && <p className="text-xs text-brand-dark/60">{paciente.documento}</p>}
              </div>
              <button type="button" onClick={() => setPaciente(null)} className={btnGhost}>Cambiar</button>
            </div>
          ) : (
            <>
              <input
                name="paciente_q"
                type="search"
                value={qPac}
                onChange={(e) => {
                  setQPac(e.target.value);
                  if (e.target.value.trim().length < 2) setResPac([]);
                }}
                placeholder="Buscar paciente por nombre, cédula o celular (opcional)"
                autoComplete="off"
                maxLength={60}
                aria-label="Buscar paciente"
                className={inputCls}
              />
              {resPac.length > 0 && (
                <ul className="divide-y divide-brand/10 rounded-xl ring-1 ring-brand/10">
                  {resPac.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setPaciente({ id: p.id, nombre: p.nombre, documento: p.documento });
                          setResPac([]);
                          setQPac("");
                        }}
                        className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-iris-light/50 focus-visible:bg-iris-light"
                      >
                        <span className="font-medium text-brand">{p.nombre}</span>
                        <span className="text-xs text-brand-dark/60">{[p.documento, p.telefono].filter(Boolean).join(" · ")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-brand-dark/60">Sin paciente es una venta de mostrador (no se puede generar orden de trabajo).</p>
            </>
          )}
        </section>

        {/* 2. Productos */}
        <section className={`${card} flex flex-col gap-3`}>
          <h2 className="font-semibold text-brand">2. Productos</h2>
          <div className="flex flex-wrap gap-2">
            <input
              name="q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
                  e.preventDefault();
                  if (filtrados[0]) {
                    agregar(filtrados[0]);
                    setQ("");
                  }
                }
              }}
              placeholder="Buscar producto o código…  (Enter agrega el primero)"
              autoComplete="off"
              aria-label="Buscar producto"
              className={`${inputCls} min-w-56 flex-1`}
            />
            {[{ id: "todos", label: "Todos" }, ...TIPOS_PRODUCTO].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTipo(t.id)}
                aria-pressed={tipo === t.id}
                className={`min-h-11 rounded-full border px-4 text-sm font-medium ${tipo === t.id ? "border-brand bg-brand text-white" : "border-brand/20 text-brand hover:bg-iris-light"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {productos.length === 0 ? (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-brand">Aún no hay productos en el catálogo. Pídele al administrador que los cargue en “Productos”.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {filtrados.map((p) => {
                const agotado = p.controla_stock && p.stock < 1;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={agotado}
                    onClick={() => agregar(p)}
                    className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-brand/15 px-3 py-2 text-left hover:bg-iris-light/50 disabled:opacity-50"
                  >
                    <Miniatura id={p.id} tiene={Boolean(p.tiene_foto)} className="size-14" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-brand">{p.nombre}</span>
                      <span className="text-xs text-brand-dark/60">
                        {tipoLabel(p.tipo)}
                        {p.controla_stock ? (agotado ? " · agotado" : ` · stock ${p.stock}`) : " · a pedido"}
                      </span>
                    </span>
                    <span className="font-semibold text-brand">{dinero(p.precio)}</span>
                  </button>
                );
              })}
              {filtrados.length === 0 && <p className="text-sm text-brand-dark/70">No hay productos que coincidan.</p>}
            </div>
          )}

          {/* Carrito: una tarjeta por renglon (sin desplazamiento lateral en celular) */}
          {lineas.length > 0 && (
            <ul className="flex flex-col gap-2">
              {lineas.map((l) => {
                const bruto = redondear(l.cantidad * l.precio);
                const neto = redondear(bruto - redondear((bruto * l.descuento_pct) / 100));
                return (
                  <li key={l.product_id} className="flex flex-col gap-2 rounded-xl border border-brand/15 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <Miniatura id={l.product_id} tiene={Boolean(l.tiene_foto)} className="size-12" />
                        <div>
                          <p className="font-medium text-brand">{l.nombre}</p>
                          <p className="text-xs text-brand-dark/60">{dinero(l.precio)} c/u</p>
                        </div>
                      </div>
                      <button type="button" aria-label={`Quitar ${l.nombre}`} onClick={() => quitar(l.product_id)} className="size-11 shrink-0 rounded-lg text-red-700 hover:bg-red-50">✕</button>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                      <div className="flex items-center gap-1">
                        <button type="button" aria-label="Quitar uno" onClick={() => cambiar(l.product_id, { cantidad: Math.max(1, l.cantidad - 1) })} className="size-11 rounded-lg border border-brand/20 text-lg text-brand hover:bg-iris-light">−</button>
                        <span className="w-9 text-center font-medium">{l.cantidad}</span>
                        <button type="button" aria-label="Agregar uno" onClick={() => cambiar(l.product_id, { cantidad: Math.min(l.controla_stock ? l.stock : 999, l.cantidad + 1) })} className="size-11 rounded-lg border border-brand/20 text-lg text-brand hover:bg-iris-light">+</button>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-brand-dark/70">
                        Desc. %
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={100}
                          step="0.5"
                          value={l.descuento_pct || ""}
                          placeholder="0"
                          aria-label={`Descuento de ${l.nombre}`}
                          onChange={(e) => cambiar(l.product_id, { descuento_pct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                          className={`${inputCls} !w-20`}
                        />
                      </label>
                      <p className="ml-auto text-lg font-semibold text-brand">{dinero(neto)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 3. Orden de trabajo */}
        <section className={`${card} flex flex-col gap-3`}>
          <label className="flex min-h-11 items-center gap-3 font-semibold text-brand">
            <input type="checkbox" checked={conOrden} onChange={(e) => setOrdenManual(e.target.checked)} className="size-5 accent-[#262d7a]" />
            3. Generar orden de trabajo para el laboratorio
          </label>
          {conOrden && (
            <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
              <label className="flex flex-col gap-1 text-sm font-medium text-brand">
                Fecha de entrega
                <input type="date" value={entrega} onChange={(e) => setEntrega(e.target.value)} className={inputCls} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-brand">
                Notas para el laboratorio
                <input value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={1000} autoComplete="off" className={inputCls} />
              </label>
              <p className="text-xs text-brand-dark/60 sm:col-span-2">
                La orden lleva la hoja RX de la última ficha del paciente (si el doctor la llenó).
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Resumen y cobro */}
      <aside className={`${card} flex flex-col gap-4 lg:sticky lg:top-4`}>
        <h2 className="font-semibold text-brand">Resumen</h2>
        <dl className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{dinero(t.subtotal)}</dd></div>
          <div className="flex items-center justify-between gap-2">
            <dt>Descuento</dt>
            <dd className="flex items-center gap-1">
              <select value={desc.tipo} onChange={(e) => setDesc({ ...desc, tipo: e.target.value as DescuentoGlobal["tipo"] })} aria-label="Tipo de descuento" className={`${inputCls} !w-16 !px-2`}>
                <option value="porcentaje">%</option>
                <option value="monto">$</option>
              </select>
              <input type="number" inputMode="decimal" min={0} step="0.5" value={desc.valor || ""} placeholder="0" aria-label="Descuento" onChange={(e) => setDesc({ ...desc, valor: Math.max(0, Number(e.target.value) || 0) })} className={`${inputCls} !w-20`} />
            </dd>
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label="Descuentos rápidos">
            {[5, 10, 20].map((n) => (
              <button key={n} type="button" onClick={() => setDesc({ tipo: "porcentaje", valor: desc.tipo === "porcentaje" && desc.valor === n ? 0 : n })} aria-pressed={desc.tipo === "porcentaje" && desc.valor === n} className={`min-h-11 rounded-lg border px-3 text-sm font-medium ${desc.tipo === "porcentaje" && desc.valor === n ? "border-brand bg-brand text-white" : "border-brand/20 text-brand hover:bg-iris-light"}`}>
                {n} %
              </button>
            ))}
          </div>
          {t.global > 0 && <div className="flex justify-between text-brand-dark/70"><dt>− Descuento</dt><dd>{dinero(t.global)}</dd></div>}
          <div className="mt-1 flex justify-between border-t border-brand/10 pt-2 text-xl font-bold text-brand"><dt>Total</dt><dd>{dinero(t.total)}</dd></div>
          {t.descuentoTotal > 0 && (
            <p className={`text-xs ${pasaLimite ? "text-brand-dark/60" : "font-medium text-red-700"}`}>
              Descuento total: {dinero(t.descuentoTotal)} ({t.pctTotal.toFixed(1)} %)
              {!pasaLimite && ` — máximo ${MAX_DESCUENTO_RECEPCION} % sin autorización`}
            </p>
          )}
        </dl>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-brand">Cobro</legend>
          <div className="grid grid-cols-2 gap-2">
            {([["total", "Pago completo"], ["mitad", "Abono 50 %"], ["otro", "Otro monto"], ["ninguno", "Sin pago"]] as [PagoModo, string][]).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={pagoModo === id} onClick={() => setPagoModo(id)} className={`min-h-11 rounded-lg border px-2 text-sm font-medium ${pagoModo === id ? "border-brand bg-brand text-white" : "border-brand/20 text-brand hover:bg-iris-light"}`}>
                {label}
              </button>
            ))}
          </div>
          {pagoModo === "otro" && (
            <input type="number" inputMode="decimal" min={0} step="0.01" max={t.total} value={pagoOtro} onChange={(e) => setPagoOtro(e.target.value)} placeholder="Monto a cobrar ahora" aria-label="Monto a cobrar ahora" className={inputCls} />
          )}
          {pago > 0 && (
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Método de pago">
              {METODOS.map((m) => (
                <button key={m.id} type="button" aria-pressed={metodo === m.id} onClick={() => elegirMetodo(m.id)} className={`min-h-11 rounded-lg border px-2 text-sm font-medium ${metodo === m.id ? "border-iris bg-iris text-white" : "border-brand/20 text-brand hover:bg-iris-light"}`}>
                  {m.label}
                </button>
              ))}
            </div>
          )}
          {excede && <p role="alert" className="text-xs font-medium text-red-700">El monto supera el total ({dinero(t.total)}).</p>}
          <div className="flex justify-between text-sm"><span>Cobra ahora</span><strong>{dinero(pago)}</strong></div>
          <div className={`flex justify-between text-sm ${saldo > 0 ? "font-semibold text-amber-700" : "text-emerald-700"}`}>
            <span>Saldo pendiente</span><strong>{dinero(saldo)}</strong>
          </div>
        </fieldset>

        <label className="flex flex-col gap-1 text-sm font-medium text-brand">
          Observaciones (opcional)
          <input value={obs} onChange={(e) => setObs(e.target.value)} maxLength={1000} autoComplete="off" className={inputCls} />
        </label>

        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button disabled={enviando || lineas.length === 0} className={`${btnPrimary} !min-h-12 text-base`}>
          {enviando ? "Registrando…" : "Registrar venta"}
        </button>
        {lineas.length > 0 && (
          // Barra fija en celular / tableta: total, saldo y registrar sin bajar hasta el final.
          <div className="fixed inset-x-0 bottom-[4.4rem] z-30 flex items-center justify-between gap-3 border-t border-brand/10 bg-white/95 px-4 py-2 shadow-lg backdrop-blur lg:hidden">
            <div className="leading-tight">
              <p className="text-xs text-brand-dark/60">Total · saldo {dinero(saldo)}</p>
              <p className="text-lg font-bold text-brand">{dinero(t.total)}</p>
            </div>
            <button disabled={enviando} className={`${btnPrimary} !min-h-12`}>{enviando ? "Registrando…" : "Registrar venta"}</button>
          </div>
        )}
        <p className="text-center text-xs text-brand-dark/60">
          <kbd className="rounded bg-iris-light px-1">/</kbd> buscar producto · <kbd className="rounded bg-iris-light px-1">Ctrl</kbd>+<kbd className="rounded bg-iris-light px-1">Enter</kbd> registrar
        </p>
      </aside>
    </form>
  );
}
