"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/lib/validation";
import { btnGhost, btnPrimary, inputCls } from "@/lib/ui";

type Initial = { nombre?: string; direccion?: string | null; telefono?: string | null; edad?: number | null; ocupacion?: string | null };

export function PatientForm({
  action,
  initial = {},
  submitLabel,
  cancelHref,
  optometristas,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: Initial;
  submitLabel: string;
  cancelHref: string;
  // Si se pasa (aunque sea vacio), se ofrece dar turno al registrar.
  optometristas?: { id: string; nombre: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, {} as FormState);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-brand">
        Nombre completo *
        <input name="nombre" required maxLength={200} defaultValue={initial.nombre ?? ""} className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-brand">
        Teléfono
        <input name="telefono" type="tel" maxLength={30} defaultValue={initial.telefono ?? ""} className={inputCls} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-brand">
          Edad
          <input name="edad" type="number" min={0} max={130} defaultValue={initial.edad ?? ""} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-brand">
          Ocupación
          <input name="ocupacion" maxLength={120} defaultValue={initial.ocupacion ?? ""} className={inputCls} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium text-brand">
        Dirección
        <input name="direccion" maxLength={300} defaultValue={initial.direccion ?? ""} className={inputCls} />
      </label>

      {optometristas && (
        <fieldset className="flex flex-col gap-3 rounded-xl bg-iris-light/60 p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-brand">
            <input type="checkbox" name="dar_turno" defaultChecked className="size-4 accent-[#262d7a]" />
            Dar turno ahora (pasa a la lista de espera de hoy)
          </label>
          <label className="flex flex-col gap-1 text-sm text-brand">
            Optometrista
            <select name="optometrista_id" defaultValue="" className={inputCls}>
              <option value="">Cualquiera disponible</option>
              {optometristas.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
      )}

      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Guardando…" : submitLabel}
        </button>
        <Link href={cancelHref} className={btnGhost}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
