"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { TIPOS_PRODUCTO } from "@/lib/ventas";
import { btnGhost, btnPrimary, inputCls } from "@/lib/ui";
import type { FormState } from "@/lib/validation";

type Inicial = { nombre?: string; tipo?: string; codigo?: string | null; precio?: number; stock_minimo?: number; controla_stock?: boolean };

export function ProductoForm({
  action,
  initial = {},
  nuevo,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: Inicial;
  nuevo?: boolean;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as FormState);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const v = (c: string, ini: string | number | null | undefined) => state.values?.[c] ?? String(ini ?? "");
  const controla = state.values ? state.values.controla_stock === "on" : (initial.controla_stock ?? true);
  useEffect(() => {
    if (state.error) errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [state]);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-brand">
        Nombre *
        <input name="nombre" required maxLength={200} defaultValue={v("nombre", initial.nombre)} autoComplete="off" className={inputCls} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-brand">
          Tipo *
          <select name="tipo" defaultValue={v("tipo", initial.tipo ?? "montura")} className={inputCls}>
            {TIPOS_PRODUCTO.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-brand">
          Código (opcional)
          <input name="codigo" maxLength={40} defaultValue={v("codigo", initial.codigo)} autoComplete="off" className={inputCls} />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-brand">
          Precio ($) *
          <input name="precio" type="number" inputMode="decimal" step="0.01" min="0" required defaultValue={v("precio", initial.precio)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-brand">
          Stock mínimo
          <input name="stock_minimo" type="number" min="0" step="1" defaultValue={v("stock_minimo", initial.stock_minimo ?? 0)} className={inputCls} />
        </label>
        {nuevo && (
          <label className="flex flex-col gap-1 text-sm font-medium text-brand">
            Stock inicial
            <input name="stock" type="number" min="0" step="1" defaultValue={v("stock", 0)} className={inputCls} />
          </label>
        )}
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-brand">
        <input type="checkbox" name="controla_stock" defaultChecked={controla} className="size-5 accent-[#262d7a]" />
        Controla stock (desmárcalo para lentes que se mandan a hacer)
      </label>

      {state.error && <p ref={errorRef} role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div className="flex gap-3">
        <button disabled={pending} className={btnPrimary}>{pending ? "Guardando…" : submitLabel}</button>
        <Link href="/dashboard/productos" className={btnGhost}>Cancelar</Link>
      </div>
    </form>
  );
}

export function AjusteStockForm({ action, stock }: { action: (prev: FormState, formData: FormData) => Promise<FormState>; stock: number }) {
  const [state, formAction, pending] = useActionState(action, {} as FormState);
  return (
    <form action={formAction} key={stock} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-brand">
        Entrada (+) o salida (−)
        <input name="delta" type="number" step="1" required placeholder="Ej. 10 o -2" className={`${inputCls} !w-40`} />
      </label>
      <button disabled={pending} className={btnGhost}>{pending ? "Guardando…" : "Ajustar stock"}</button>
      {state.error && <p role="alert" className="w-full text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
