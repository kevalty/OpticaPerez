"use client";

import { useActionState } from "react";
import { guardarNombreUsuario, type EstadoAdmin } from "@/app/dashboard/admin/actions";
import { btnGhost, inputCls } from "@/lib/ui";

// Edicion del nombre de un usuario (el unico dato que se cambia desde la app).
export function UsuarioNombre({ id, nombre }: { id: string; nombre: string }) {
  const [st, accion, pend] = useActionState(guardarNombreUsuario.bind(null, id), {} as EstadoAdmin);
  return (
    <form key={st.nombre ?? nombre} action={accion} className="flex flex-wrap items-center gap-2">
      <input name="nombre" defaultValue={st.nombre ?? nombre} required minLength={2} maxLength={120} autoComplete="off" aria-label="Nombre" className={`${inputCls} !w-full sm:!w-64`} />
      <button disabled={pend} className={btnGhost}>{pend ? "Guardando…" : "Guardar nombre"}</button>
      {st.ok && <span role="status" className="text-sm text-emerald-700">Guardado.</span>}
      {st.error && <span role="alert" className="text-sm text-red-700">{st.error}</span>}
    </form>
  );
}
