"use client";

import { useActionState } from "react";
import { registrarAbono, anularVenta, type EstadoForm } from "@/app/dashboard/ventas/actions";
import { METODOS } from "@/lib/ventas";
import { btnGhost, btnPrimary, inputCls } from "@/lib/ui";

// Registrar un abono (o el pago del saldo). El monto viene precargado con el saldo pendiente.
export function AbonoForm({ ventaId, saldo }: { ventaId: string; saldo: number }) {
  const [state, action, pending] = useActionState(registrarAbono.bind(null, ventaId), {} as EstadoForm);
  return (
    <form action={action} key={saldo} className="grid gap-3 sm:grid-cols-[8rem_10rem_1fr_auto] sm:items-end">
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
      {state.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-4">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 sm:col-span-4">Pago registrado.</p>}
    </form>
  );
}

export function AnularForm({ ventaId }: { ventaId: string }) {
  const [state, action, pending] = useActionState(anularVenta.bind(null, ventaId), {} as EstadoForm);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("¿Anular esta venta? Se devuelve el stock y se archiva la orden de trabajo. No se puede deshacer.")) e.preventDefault();
      }}
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
    >
      <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-red-700">
        Motivo de la anulación
        <input name="motivo" required minLength={3} maxLength={500} autoComplete="off" className={inputCls} />
      </label>
      <button disabled={pending} className={`${btnGhost} !border-red-300 !text-red-700 hover:!bg-red-50`}>{pending ? "Anulando…" : "Anular venta"}</button>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
