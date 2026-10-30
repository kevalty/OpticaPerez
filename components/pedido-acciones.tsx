"use client";

import { useActionState, useEffect, useState } from "react";
import { enviarPedidoWA, type EstadoWA } from "@/app/dashboard/whatsapp/actions";
import { cambiarEstadoPedido, guardarEntrega, type EstadoPedidoForm } from "@/app/dashboard/pedidos/actions";
import { btnGhost, btnPrimary, inputCls } from "@/lib/ui";

// Boton grande para avanzar el pedido al siguiente estado (y, solo el administrador, corregir un paso atras).
export function CambiarEstado({
  ordenId,
  siguiente,
  anterior,
  puedeRetroceder,
  saldoPendiente = 0,
}: {
  ordenId: string;
  siguiente: { id: string; label: string } | null;
  anterior: { id: string; label: string } | null;
  puedeRetroceder: boolean;
  saldoPendiente?: number;
}) {
  const [stAvanzar, avanzar, pendA] = useActionState(cambiarEstadoPedido.bind(null, ordenId, siguiente?.id ?? ""), {} as EstadoPedidoForm);
  const [stAtras, atras, pendB] = useActionState(cambiarEstadoPedido.bind(null, ordenId, anterior?.id ?? ""), {} as EstadoPedidoForm);
  const [confirmando, setConfirmando] = useState(false);
  const [confirmaEntrega, setConfirmaEntrega] = useState(false);
  // El administrador puede entregar con saldo, pero se le pide confirmar.
  const pideConfirmar = siguiente?.id === "entregado" && saldoPendiente > 0 && puedeRetroceder;
  const error = stAvanzar.error ?? stAtras.error;
  const aviso = stAvanzar.aviso;
  const avisoFallo = stAvanzar.avisoFallo;

  return (
    <div className="flex flex-col gap-2">
      {siguiente ? (
        pideConfirmar && !confirmaEntrega ? (
          <button type="button" onClick={() => setConfirmaEntrega(true)} className={`${btnPrimary} !min-h-14 w-full text-base sm:w-auto sm:px-8`}>
            Marcar como: {siguiente.label} →
          </button>
        ) : (
          <form action={avanzar} className="flex flex-col gap-2">
            {pideConfirmar && (
              <p className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800">
                Hay un saldo de <strong>${saldoPendiente.toFixed(2).replace(".", ",")}</strong>. ¿Entregar igual?
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button disabled={pendA} className={`${btnPrimary} !min-h-14 w-full text-base sm:w-auto sm:px-8`}>
                {pendA ? "Guardando…" : pideConfirmar ? "Sí, entregar con saldo" : `Marcar como: ${siguiente.label} →`}
              </button>
              {pideConfirmar && <button type="button" onClick={() => setConfirmaEntrega(false)} className={btnGhost}>Cancelar</button>}
            </div>
          </form>
        )
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
            <button type="button" onClick={() => setConfirmando(true)} className={`${btnGhost} w-fit`}>↩ Corregir: volver un paso (administrador)</button>
          )}
        </form>
      )}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {!error && aviso && <p role={avisoFallo ? "alert" : "status"} className={`rounded-lg px-3 py-2 text-sm ${avisoFallo ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>{aviso}</p>}
    </div>
  );
}

// Boton de envio automatico por WhatsApp (recibo o aviso de pedido listo) con respuesta clara.
export function EnviarWA({ ordenId, tipo, etiqueta, destacado, yaEnviado }: { ordenId: string; tipo: "pedido_recibo" | "pedido_listo"; etiqueta: string; destacado?: boolean; yaEnviado?: string | null }) {
  const [st, accion, pend] = useActionState(enviarPedidoWA.bind(null, ordenId, tipo), {} as EstadoWA);
  return (
    <form action={accion} className="flex flex-col gap-1">
      {yaEnviado && <span className="text-xs text-amber-700">Ya se avisó el {yaEnviado}.</span>}
      <button
        disabled={pend}
        onClick={(e) => { if (yaEnviado && !window.confirm(`Ya se avisó al cliente el ${yaEnviado}. ¿Enviar el mismo mensaje otra vez?`)) e.preventDefault(); }}
        className={destacado && !yaEnviado ? `${btnPrimary} !bg-emerald-600 hover:!bg-emerald-700` : btnGhost}
      >
        {pend ? "Enviando…" : yaEnviado ? `${etiqueta} (otra vez)` : etiqueta}
      </button>
      {st.ok && <span role="status" className="text-sm text-emerald-700">Enviado por WhatsApp.</span>}
      {st.error && <span role="alert" className="text-sm text-red-700">{st.error}</span>}
    </form>
  );
}

export function FechaEntrega({ ordenId, valor }: { ordenId: string; valor: string | null }) {
  const [st, action, pend] = useActionState(guardarEntrega.bind(null, ordenId), {} as EstadoPedidoForm);
  const [descartado, setDescartado] = useState<EstadoPedidoForm | null>(null);
  const visible = st !== descartado;
  // "Guardada." se quita solo a los pocos segundos.
  useEffect(() => {
    if (!st.ok) return;
    const t = setTimeout(() => setDescartado(st), 4000);
    return () => clearTimeout(t);
  }, [st]);
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

// Enlace manual de WhatsApp (wa.me): si el cliente ya recibio ese aviso, pide confirmacion antes de abrirlo.
export function EnlaceWA({ href, etiqueta, destacado, yaEnviado }: { href: string; etiqueta: string; destacado?: boolean; yaEnviado?: string | null }) {
  return (
    <span className="flex flex-col gap-1">
      {yaEnviado && <span className="text-xs text-amber-700">Ya se avisó el {yaEnviado}.</span>}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => { if (yaEnviado && !window.confirm(`Ya se avisó al cliente el ${yaEnviado}. ¿Abrir WhatsApp para enviarlo otra vez?`)) e.preventDefault(); }}
        className={destacado && !yaEnviado ? `${btnPrimary} !bg-emerald-600 hover:!bg-emerald-700` : btnGhost}
      >
        {etiqueta}
      </a>
    </span>
  );
}
