"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { TurnoFields } from "@/components/turno-fields";
import type { FormState } from "@/lib/validation";
import { btnGhost, btnPrimary, inputCls } from "@/lib/ui";

type Initial = {
  nombre?: string;
  tipo_documento?: string;
  documento?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  edad?: number | null;
  ocupacion?: string | null;
};

export function PatientForm({
  action,
  initial = {},
  submitLabel,
  cancelHref,
  turno,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: Initial;
  submitLabel: string;
  cancelHref: string;
  // Si se pasa, se ofrece dar turno al registrar (solo recepcion / administrador).
  turno?: { hoy: string; optometristas: { id: string; nombre: string }[] };
}) {
  const [state, formAction, pending] = useActionState(action, {} as FormState);
  const [tipo, setTipo] = useState(initial.tipo_documento ?? "cedula");
  const [darTurno, setDarTurno] = useState(true);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-brand">
        Nombre completo *
        <input name="nombre" required maxLength={200} defaultValue={initial.nombre ?? ""} className={inputCls} />
      </label>

      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <label className="flex flex-col gap-1 text-sm font-medium text-brand">
          Documento *
          <select name="tipo_documento" value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
            <option value="cedula">Cédula</option>
            <option value="pasaporte">Pasaporte</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-brand">
          {tipo === "cedula" ? "Número de cédula *" : "Número de pasaporte *"}
          <input
            name="documento"
            required
            maxLength={20}
            inputMode={tipo === "cedula" ? "numeric" : "text"}
            pattern={tipo === "cedula" ? "[0-9]{10}" : "[A-Za-z0-9]{5,20}"}
            title={tipo === "cedula" ? "10 dígitos" : "5 a 20 letras o números"}
            defaultValue={initial.documento ?? ""}
            className={inputCls}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-brand">
        Celular *
        <input name="telefono" type="tel" required maxLength={30} defaultValue={initial.telefono ?? ""} className={inputCls} />
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

      {turno && (
        <fieldset className="flex flex-col gap-3 rounded-xl bg-iris-light/60 p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-brand">
            <input
              type="checkbox"
              name="dar_turno"
              checked={darTurno}
              onChange={(e) => setDarTurno(e.target.checked)}
              className="size-4 accent-[#262d7a]"
            />
            Dar turno al registrar
          </label>
          {darTurno && <TurnoFields hoy={turno.hoy} optometristas={turno.optometristas} />}
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
