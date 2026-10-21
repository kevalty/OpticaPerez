"use client";

import { useActionState, useState, useTransition } from "react";
import { enviarRecordatorio, guardarPlantilla, probarWhatsApp, type EstadoWA } from "@/app/dashboard/whatsapp/actions";
import { btnGhost, btnPrimary, inputCls } from "@/lib/ui";

export type PendienteFila = { tipo: string; patient_id: string; ref_id: string; paciente: string; telefono: string | null; detalle: string; etiqueta: string };

// Lista de recordatorios por enviar: cada fila se manda con un boton; el servidor vuelve a comprobar que siga pendiente.
export function ListaPendientes({ filas, activos }: { filas: PendienteFila[]; activos: Record<string, boolean> }) {
  const [resultado, setResultado] = useState<Record<string, EstadoWA>>({});
  const [pend, iniciar] = useTransition();
  const clave = (f: PendienteFila) => `${f.tipo}:${f.ref_id}`;

  if (filas.length === 0) return <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">No hay recordatorios pendientes por hoy.</p>;
  return (
    <ul className="divide-y divide-brand/10 rounded-2xl bg-white ring-1 ring-brand/10">
      {filas.map((f) => {
        const r = resultado[clave(f)];
        return (
          <li key={clave(f)} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-medium text-brand">{f.paciente}</p>
              <p className="text-sm text-brand-dark/70">{f.etiqueta} · {f.detalle}</p>
              {!activos[f.tipo] && <p className="text-xs text-amber-700">Plantilla inactiva: actívala en «Plantillas».</p>}
              {r?.error && <p role="alert" className="text-sm text-red-700">{r.error}</p>}
            </div>
            {r?.ok ? (
              <span role="status" className="text-sm font-semibold text-emerald-700">Enviado ✓</span>
            ) : (
              <button
                disabled={pend || !activos[f.tipo]}
                onClick={() => iniciar(async () => { const res = await enviarRecordatorio({ tipo: f.tipo, patient_id: f.patient_id, ref_id: f.ref_id }); setResultado((p) => ({ ...p, [clave(f)]: res })); })}
                className={btnPrimary}
              >
                {pend ? "Enviando…" : "Enviar por WhatsApp"}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export type PlantillaFila = { tipo: string; etiqueta: string; nombre: string; idioma: string; activa: boolean; descripcion: string; texto_sugerido: string };

function FilaPlantilla({ p, editable }: { p: PlantillaFila; editable: boolean }) {
  const [st, accion, pend] = useActionState(guardarPlantilla.bind(null, p.tipo), {} as EstadoWA);
  return (
    <li className="flex flex-col gap-2 rounded-2xl bg-white p-4 ring-1 ring-brand/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-brand">{p.etiqueta}</h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.activa ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{p.activa ? "Activa" : "Inactiva"}</span>
      </div>
      <p className="text-sm text-brand-dark/70">{p.descripcion}</p>
      <details className="text-sm">
        <summary className="cursor-pointer text-iris">Texto para crear la plantilla en Meta</summary>
        <p className="mt-1 whitespace-pre-wrap rounded-lg bg-iris-light/40 p-3 text-brand-dark/80">{p.texto_sugerido}</p>
      </details>
      {editable ? (
        <form action={accion} className="grid items-end gap-3 sm:grid-cols-[1fr_8rem_auto_auto]">
          <label className="flex flex-col gap-1 text-xs font-medium text-brand">Nombre en Meta<input name="nombre" defaultValue={p.nombre} className={inputCls} /></label>
          <label className="flex flex-col gap-1 text-xs font-medium text-brand">Idioma<input name="idioma" defaultValue={p.idioma} className={inputCls} /></label>
          <label className="flex min-h-11 items-center gap-2 text-sm text-brand"><input type="checkbox" name="activa" defaultChecked={p.activa} className="size-5" />Activa</label>
          <button disabled={pend} className={btnPrimary}>{pend ? "Guardando…" : "Guardar"}</button>
          {st.error && <p role="alert" className="text-sm text-red-700 sm:col-span-4">{st.error}</p>}
          {st.ok && <p role="status" className="text-sm text-emerald-700 sm:col-span-4">Guardado.</p>}
        </form>
      ) : (
        <p className="text-xs text-brand-dark/60">Plantilla en Meta: <strong>{p.nombre}</strong> ({p.idioma}). Solo el administrador la cambia.</p>
      )}
    </li>
  );
}

export function ListaPlantillas({ plantillas, editable }: { plantillas: PlantillaFila[]; editable: boolean }) {
  return <ul className="flex flex-col gap-3">{plantillas.map((p) => <FilaPlantilla key={p.tipo} p={p} editable={editable} />)}</ul>;
}

// Administrador: manda la plantilla de ejemplo de Meta a un celular para comprobar las claves.
export function ProbarWhatsApp() {
  const [st, accion, pend] = useActionState(probarWhatsApp, {} as EstadoWA);
  return (
    <form action={accion} className="flex flex-col gap-2 rounded-2xl bg-white p-4 ring-1 ring-brand/10">
      <h3 className="font-semibold text-brand">Probar la conexión</h3>
      <p className="text-sm text-brand-dark/70">Envía el mensaje de ejemplo de Meta (hello_world) a un celular. En modo de prueba solo funciona con los números registrados en Meta.</p>
      <div className="flex flex-wrap gap-2">
        <input name="telefono" type="tel" required placeholder="09XXXXXXXX" className={`${inputCls} max-w-56`} />
        <button disabled={pend} className={btnGhost}>{pend ? "Enviando…" : "Enviar prueba"}</button>
      </div>
      {st.error && <p role="alert" className="text-sm text-red-700">{st.error}</p>}
      {st.ok && <p role="status" className="text-sm text-emerald-700">Mensaje enviado. Revisa el celular.</p>}
    </form>
  );
}
