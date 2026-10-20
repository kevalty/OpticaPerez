import type { Metadata } from "next";
import Image from "next/image";
import { NEGOCIO } from "@/lib/negocio";
import { ESTADOS_PEDIDO, SEDE_ENTREGA, estadoInfo, fechaCorta, indiceEstado, lineasEspecificaciones, type Especificaciones } from "@/lib/pedidos";
import { createClient } from "@/lib/supabase/server";
import { dinero } from "@/lib/ventas";

// Pagina publica del cliente: sin cuenta, solo con el token exclusivo de su pedido. No se indexa ni envia el enlace como referencia.
export const metadata: Metadata = { title: "Seguimiento de tu pedido · Óptica Pérez", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

type Seg = {
  numero: number; nombre_pila: string; estado: string; creado: string; fecha_entrega: string | null; entregado_en: string | null; saldo: number;
  items: { nombre: string | null; cantidad: number }[];
  especificaciones: Especificaciones;
  historial: { estado: string; fecha: string }[];
};

export default async function SeguimientoPage({ params }: PageProps<"/seguimiento/[token]">) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("seguimiento_publico", { p_token: token });
  const s = data as Seg | null;
  const sucursal = NEGOCIO.sucursales[0];

  if (!s) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
        <Image src="/logo.png" alt="Óptica Pérez" width={360} height={249} className="h-auto w-36" />
        <h1 className="text-xl font-semibold text-brand">No encontramos este pedido</h1>
        <p className="text-sm text-brand-dark/70">Revisa que el enlace esté completo. Si el problema continúa, comunícate con nosotros por WhatsApp o pasa por el local.</p>
      </main>
    );
  }

  const idx = indiceEstado(s.estado);
  const info = estadoInfo(s.estado);
  const spec = lineasEspecificaciones(s.especificaciones);
  const fechaDe = (id: string) => [...s.historial].reverse().find((h) => h.estado === id)?.fecha;
  const listo = s.estado === "listo_para_recibir";

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <Image src="/logo.png" alt="Óptica Pérez" width={360} height={249} className="h-auto w-28" />
        <p className="font-mono text-sm text-brand-dark/60">Pedido N.º {String(s.numero).padStart(6, "0")}</p>
      </header>

      <section className={`rounded-3xl p-5 text-center ring-1 ${listo ? "bg-emerald-50 ring-emerald-200" : "bg-iris-light/50 ring-brand/10"}`}>
        <p className="text-sm text-brand-dark/70">Hola, {s.nombre_pila} 👋</p>
        <h1 className="mt-1 text-2xl font-bold text-brand">{info?.cliente}</h1>
        <p className="mt-2 text-sm text-brand-dark/80">{info?.detalle}</p>
        {s.fecha_entrega && s.estado !== "entregado" && !listo && (
          <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-sm">Fecha estimada: <strong>{fechaCorta(s.fecha_entrega)}</strong></p>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-brand/10">
        <h2 className="mb-3 font-semibold text-brand">¿Cómo va tu pedido?</h2>
        <ol className="flex flex-col">
          {ESTADOS_PEDIDO.map((e, i) => {
            const hecho = i <= idx;
            const f = fechaDe(e.id);
            return (
              <li key={e.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${hecho ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"}`}>{hecho ? "✓" : i + 1}</span>
                  {i < ESTADOS_PEDIDO.length - 1 && <span className={`w-0.5 flex-1 ${i < idx ? "bg-emerald-300" : "bg-slate-200"}`} />}
                </div>
                <div className="pb-4">
                  <p className={`font-medium ${i === idx ? "text-brand" : hecho ? "text-brand-dark" : "text-brand-dark/40"}`}>{e.label}</p>
                  {hecho && f && <p className="text-xs text-brand-dark/60">{fechaCorta(f)}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-brand/10">
        <h2 className="mb-2 font-semibold text-brand">Tu pedido</h2>
        <ul className="divide-y divide-brand/10 text-sm">
          {s.items.map((i, k) => (
            <li key={k} className="flex justify-between py-1.5"><span>{i.nombre ?? "Producto"}</span><span className="font-semibold">× {i.cantidad}</span></li>
          ))}
        </ul>
        {spec.map((x) => (
          <div key={x.titulo} className="mt-3 rounded-xl bg-iris-light/40 px-4 py-2 text-sm">
            <p className="font-semibold text-brand">{x.titulo}</p>
            <ul>{x.lineas.map((l) => <li key={l}>{l}</li>)}</ul>
          </div>
        ))}
        {s.estado !== "entregado" && (
          <p className={`mt-3 text-sm ${s.saldo > 0 ? "font-semibold text-amber-700" : "text-emerald-700"}`}>
            {s.saldo > 0 ? `Saldo pendiente: ${dinero(s.saldo)}` : "Tu pedido está totalmente pagado."}
          </p>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 text-sm ring-1 ring-brand/10">
        <h2 className="mb-1 font-semibold text-brand">Retíralo en {SEDE_ENTREGA}</h2>
        <ul className="text-brand-dark/80">{sucursal?.locales.map((l) => <li key={l}>{l}</li>)}</ul>
      </section>

      <p className="pb-4 text-center text-xs text-brand-dark/50">{NEGOCIO.nombre} · en tus ojos desde 1977</p>
    </main>
  );
}
