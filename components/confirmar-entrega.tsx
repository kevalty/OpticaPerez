"use client";

import { useActionState } from "react";
import { confirmarEntrega, type EstadoConfirmacion } from "@/app/seguimiento/[token]/actions";
import { GARANTIA } from "@/lib/negocio";
import { btnPrimary, inputCls } from "@/lib/ui";

// Confirmacion de entrega para el cliente (en su celular o en el iPad de la optica): recibio en buen estado y acepta la garantia.
export function ConfirmarEntrega({ token, via, nombreSugerido }: { token: string; via: "ipad" | "whatsapp"; nombreSugerido?: string }) {
  const [st, accion, pend] = useActionState(confirmarEntrega.bind(null, token, via), {} as EstadoConfirmacion);
  return (
    <form action={accion} className="flex flex-col gap-4">
      <div className="rounded-xl bg-iris-light/40 px-4 py-3 text-sm">
        <p className="mb-1 font-semibold text-brand">{GARANTIA.titulo}</p>
        <ul className="list-disc space-y-1 pl-5 text-brand-dark/80">
          {GARANTIA.puntos.map((p) => <li key={p}>{p}</li>)}
        </ul>
      </div>
      <label className="flex min-h-12 items-start gap-3 text-sm text-brand-dark">
        <input type="checkbox" name="buen_estado" className="mt-0.5 size-6 shrink-0 accent-[#262d7a]" />
        <span>Recibí mi pedido en buen estado y conforme a lo que solicité.</span>
      </label>
      <label className="flex min-h-12 items-start gap-3 text-sm text-brand-dark">
        <input type="checkbox" name="garantia" className="mt-0.5 size-6 shrink-0 accent-[#262d7a]" />
        <span>He leído y acepto las condiciones de la garantía.</span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-brand">
        Tu nombre completo (firma)
        <input name="nombre" defaultValue={nombreSugerido} required minLength={2} maxLength={120} autoComplete="name" className={inputCls} />
      </label>
      <button disabled={pend} className={`${btnPrimary} !min-h-14 text-base`}>{pend ? "Guardando…" : "Confirmar mi entrega"}</button>
      {st.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{st.error}</p>}
    </form>
  );
}
