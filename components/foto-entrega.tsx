"use client";

import { useActionState, useState } from "react";
import { subirFotoEntrega, type EstadoPedidoForm } from "@/app/dashboard/pedidos/actions";
import { FotoCampo } from "@/components/foto-campo";
import { btnPrimary } from "@/lib/ui";

// Agrega una foto de la entrega al pedido (camara o galeria). La foto ya viene reducida desde el celular.
// El padre le pone key={cantidad de fotos}: al guardarse una, el formulario se limpia para agregar otra.
export function FotoEntregaForm({ ordenId }: { ordenId: string }) {
  const [foto, setFoto] = useState<File | null>(null);
  const [st, accion, pend] = useActionState(subirFotoEntrega.bind(null, ordenId), {} as EstadoPedidoForm);
  return (
    <form
      action={async (fd) => {
        if (foto) fd.set("foto", foto);
        accion(fd);
      }}
      className="flex max-w-sm flex-col gap-2"
    >
      <FotoCampo titulo="Foto de la entrega" onChange={setFoto} />
      <button disabled={pend || !foto} className={`${btnPrimary} !min-h-12`}>{pend ? "Subiendo…" : "Guardar foto de la entrega"}</button>
      {st.ok && <p role="status" className="text-sm text-emerald-700">Foto guardada.</p>}
      {st.error && <p role="alert" className="text-sm text-red-700">{st.error}</p>}
    </form>
  );
}
