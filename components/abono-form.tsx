"use client";

import { useActionState, useState } from "react";
import { registrarAbono, anularVenta, type EstadoForm } from "@/app/dashboard/ventas/actions";
import { METODOS } from "@/lib/ventas";
import { btnGhost, btnPrimary, inputCls } from "@/lib/ui";

// Registrar un abono (o el pago del saldo). El monto viene precargado con el saldo pendiente.
export function AbonoForm({ ventaId, saldo }: { ventaId: string; saldo: number }) {
  const [state, action, pending] = useActionState(registrarAbono.bind(null, ventaId), {} as EstadoForm);
  // Los avisos se ocultan en cuanto la persona vuelve a escribir (no quedan mensajes viejos junto a uno nuevo).
  const [descartado, setDescartado] = useState<EstadoForm | null>(null);
  const visible = state !== descartado;
  return (
    <form action={action} key={saldo} onInput={() => setDescartado(state)} className="grid gap-3 sm:grid-cols-[8rem_10rem_1fr_auto] sm:items-end">
      <label className="flex flex-col gap-1 text-sm font-medium text-brand">
        Monto ($)
        <input name="monto" type="number" inputMode="decimal" step="0.01" min="0.01" max={saldo} defaultValue={saldo.toFixed(2)} required className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-brand">
        Método
        <select name="metodo" defaultValue="efectivo" className={inputCls}>
          {METODOS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-brand">
        Nota (opcional)
        <input name="nota" maxLength={200} placeholder="Ej. segundo abono" autoComplete="off" className={inputCls} />
      </label>
      <button disabled={pending} className={btnPrimary}>{pending ? "Guardando…" : "Registrar pago"}</button>
      {visible && state.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-4">{state.error}</p>}
      {visible && state.ok && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 sm:col-span-4">Pago registrado.</p>}
    </form>
  );
}

export function AnularForm({ ventaId }: { ventaId: string }) {
  const [state, action, pending] = useActionState(anularVenta.bind(null, ventaId), {} as EstadoForm);
  // Confirmacion en la propia pagina (las ventanas del navegador pueden estar bloqueadas).
  const [confirmando, setConfirmando] = useState(false);
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-red-700">
        Motivo de la anulación
        <input name="motivo" required minLength={3} maxLength={500} autoComplete="off" onInput={() => setConfirmando(false)} className={inputCls} />
      </label>
      {confirmando ? (
        <div className="flex items-center gap-2">
          <button disabled={pending} className={`${btnPrimary} !bg-red-700 hover:!bg-red-800`}>{pending ? "Anulando…" : "Sí, anular definitivamente"}</button>
          <button type="button" onClick={() => setConfirmando(false)} className={btnGhost}>No</button>
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            const campo = e.currentTarget.form?.elements.namedItem("motivo") as HTMLInputElement | null;
            if (campo?.reportValidity()) setConfirmando(true); // exige el motivo antes de confirmar
          }}
          className={`${btnGhost} !border-red-300 !text-red-700 hover:!bg-red-50`}
        >
          Anular venta
        </button>
      )}
      {confirmando && <p className="text-xs text-red-700 sm:basis-full">Se devuelve el stock y se archiva la orden de trabajo. No se puede deshacer.</p>}
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
