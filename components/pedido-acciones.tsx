"use client";

import { useActionState, useState } from "react";
import { cambiarEstadoPedido, guardarEntrega, type EstadoPedidoForm } from "@/app/dashboard/pedidos/actions";
import { btnGhost, btnPrimary, inputCls } from "@/lib/ui";

// Boton grande para avanzar el pedido al siguiente estado (y, solo el administrador, corregir un paso atras).
export function CambiarEstado({
  ordenId,
  siguiente,
  anterior,
  puedeRetroceder,
}: {
  ordenId: string;
  siguiente: { id: string; label: string } | null;
  anterior: { id: string; label: string } | null;
  puedeRetroceder: boolean;
}) {
  const [stAvanzar, avanzar, pendA] = useActionState(cambiarEstadoPedido.bind(null, ordenId, siguiente?.id ?? ""), {} as EstadoPedidoForm);
  const [stAtras, atras, pendB] = useActionState(cambiarEstadoPedido.bind(null, ordenId, anterior?.id ?? ""), {} as EstadoPedidoForm);
  const [confirmando, setConfirmando] = useState(false);
  const error = stAvanzar.error ?? stAtras.error;

  return (
    <div className="flex flex-col gap-2">
      {siguiente ? (
        <form action={avanzar}>
          <button disabled={pendA} className={`${btnPrimary} !min-h-14 w-full text-base sm:w-auto sm:px-8`}>
            {pendA ? "Guardando…" : `Marcar como: ${siguiente.label} →`}
          </button>
        </form>
      ) : (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">Pedido entregado. No hay más pasos.</p>
      )}
      {puedeRetroceder && anterior && (
        <form action={atras} className="flex flex-wrap items-center gap-2">
          {confirmando ? (
            <>
              <button disabled={pendB} className={`${btnGhost} !border-red-300 !text-red-700`}>Sí, volver a «{anterior.label}»</button>
              <button type="button" onClick={() => setConfirmando(false)} className={btnGhost}>No</button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmando(true)} className="text-sm text-brand-dark/60 hover:underline">Corregir: volver un paso (administrador)</button>
          )}
        </form>
      )}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}

export function FechaEntrega({ ordenId, valor }: { ordenId: string; valor: string | null }) {
  const [st, action, pend] = useActionState(guardarEntrega.bind(null, ordenId), {} as EstadoPedidoForm);
  const [descartado, setDescartado] = useState<EstadoPedidoForm | null>(null);
  const visible = st !== descartado;
  return (
    <form action={action} onInput={() => setDescartado(st)} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-sm font-medium text-brand">
        Fecha estimada de entrega
        <input type="date" name="fecha_entrega" defaultValue={valor ?? ""} className={`${inputCls} !w-48`} />
      </label>
      <button disabled={pend} className={btnGhost}>{pend ? "Guardando…" : "Guardar fecha"}</button>
      {visible && st.ok && <span role="status" className="text-sm text-emerald-700">Guardada.</span>}
      {visible && st.error && <span role="alert" className="text-sm text-red-700">{st.error}</span>}
    </form>
  );
}

export function CopiarEnlace({ enlace }: { enlace: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input readOnly value={enlace} aria-label="Enlace de seguimiento" onFocus={(e) => e.currentTarget.select()} className={`${inputCls} min-w-0 flex-1 !text-xs`} />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(enlace);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
          } catch {}
        }}
        className={btnGhost}
      >
        {copiado ? "✓ Copiado" : "Copiar enlace"}
      </button>
    </div>
  );
}
