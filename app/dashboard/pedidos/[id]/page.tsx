import Link from "next/link";
import { notFound } from "next/navigation";
import { CambiarEstado, CopiarEnlace, EnviarWA, FechaEntrega } from "@/components/pedido-acciones";
import { requireRole } from "@/lib/auth";
import {
  BADGE_ESTADO,
  ESTADOS_PEDIDO,
  anteriorEstado,
  estadoInfo,
  fechaCorta,
  indiceEstado,
  lineasEspecificaciones,
  siguienteEstado,
  type Especificaciones,
} from "@/lib/pedidos";
import { enlaceSeguimiento, siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { fechaHoraLocal } from "@/lib/time";
import { btnGhost, btnPrimary, card } from "@/lib/ui";
import { uuid } from "@/lib/validation";
import { dinero } from "@/lib/ventas";
import { mensajeListo, mensajeRecibo, waLink } from "@/lib/whatsapp";
import { whatsappConfigurado } from "@/lib/whatsapp-api";

export const metadata = { title: "Pedido · Óptica Pérez" };

type Detalle = {
  id: string; estado: string; fecha_entrega: string | null; notas: string | null; creado: string; entregado_en: string | null;
  numero: number; sale_id: string; paciente: string; patient_id: string; telefono: string | null;
  total: number | null; pagado: number | null; saldo: number | null; token: string | null;
  items: { nombre: string | null; cantidad: number }[];
  especificaciones: Especificaciones;
  historial: { estado: string; fecha: string; usuario: string | null }[];
};

export default async function PedidoPage({ params }: PageProps<"/dashboard/pedidos/[id]">) {
  const user = await requireRole("recepcionista", "doctor", "administrador");
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pedido_detalle", { p_orden: id });
  if (error) console.error("pedido_detalle fallo:", error.code);
  const d = data as Detalle | null;
  if (!d) notFound();

  const puedeActuar = user.rol === "recepcionista" || user.rol === "administrador";
  const info = estadoInfo(d.estado);
  const idx = indiceEstado(d.estado);
  const spec = lineasEspecificaciones(d.especificaciones);
  const base = await siteUrl();
  const enlace = d.token ? enlaceSeguimiento(base, d.token) : null;
  const nombrePila = d.paciente.trim().split(" ")[0];

  // WhatsApp manual: el recibo (primer mensaje) y el aviso de "listo para recibir" (segundo mensaje).
  const wa1 = enlace ? waLink(d.telefono, mensajeRecibo({ nombre: nombrePila, numero: d.numero, link: enlace })) : null;
  const wa2 = enlace ? waLink(d.telefono, mensajeListo({ nombre: nombrePila, numero: d.numero, link: enlace, saldo: d.saldo ?? 0 })) : null;
  const auto = whatsappConfigurado();
  const listo = d.estado === "listo_para_recibir";
  const entregado = d.estado === "entregado";
  const antesDeListo = idx < indiceEstado("listo_para_recibir");
  const ultimaFecha = (est: string) => [...d.historial].reverse().find((h) => h.estado === est);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/pedidos" className="inline-flex min-h-11 items-center text-sm text-iris hover:underline">← Pedidos</Link>
          <h1 className="text-2xl font-semibold text-brand">{d.paciente}</h1>
          <p className="text-sm text-brand-dark/70">Venta N.º {String(d.numero).padStart(6, "0")} · pedido del {fechaCorta(d.creado)}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${BADGE_ESTADO[d.estado] ?? ""}`}>{info?.label ?? d.estado}</span>
      </div>

      {/* Avance */}
      <section className={card}>
        <ol className="grid gap-2 sm:grid-cols-5">
          {ESTADOS_PEDIDO.map((e, i) => {
            const hecho = i <= idx;
            const f = ultimaFecha(e.id);
            return (
              <li key={e.id} className={`rounded-xl border px-3 py-2 text-sm ${i === idx ? "border-brand bg-iris-light/60" : hecho ? "border-emerald-200 bg-emerald-50" : "border-brand/10 text-brand-dark/50"}`}>
                <span className={`mb-1 flex size-6 items-center justify-center rounded-full text-xs font-bold ${hecho ? "bg-emerald-600 text-white" : "bg-iris-light text-brand"}`}>{hecho && i !== idx ? "✓" : i + 1}</span>
                <span className="block font-semibold leading-tight">{e.label}</span>
                {hecho && f && <span className="text-xs text-brand-dark/60">{fechaCorta(f.fecha)}</span>}
              </li>
            );
          })}
        </ol>
        {puedeActuar && (
          <div className="mt-4 border-t border-brand/10 pt-4">
            <CambiarEstado
              ordenId={d.id}
              siguiente={siguienteEstado(d.estado) ? { id: siguienteEstado(d.estado)!.id, label: siguienteEstado(d.estado)!.label } : null}
              anterior={anteriorEstado(d.estado) ? { id: anteriorEstado(d.estado)!.id, label: anteriorEstado(d.estado)!.label } : null}
              puedeRetroceder={user.rol === "administrador"}
              saldoPendiente={d.saldo ?? 0}
            />
            {d.estado === "listo_para_recibir" && d.saldo != null && d.saldo > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 px-4 py-3">
                <p className="text-sm text-amber-800">Para entregar hay que cobrar el saldo de <strong>{dinero(d.saldo)}</strong>.</p>
                <Link href={`/dashboard/ventas/${d.sale_id}#abono`} className={btnPrimary}>Cobrar saldo</Link>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Aviso al cliente */}
      {puedeActuar && enlace && !entregado && (
        <section className={`${card} flex flex-col gap-3`}>
          <h2 className="font-semibold text-brand">Aviso al cliente por WhatsApp</h2>
          {listo && <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">El pedido está listo: avisa al cliente para que pase a retirarlo.</p>}
          <div className="flex flex-wrap gap-2">
            {/* Un solo aviso a la vez: el que corresponde al momento del pedido */}
            {auto && listo && <EnviarWA ordenId={d.id} tipo="pedido_listo" etiqueta="Avisar por WhatsApp: listo para recibir" destacado />}
            {auto && antesDeListo && <EnviarWA ordenId={d.id} tipo="pedido_recibo" etiqueta="Reenviar recibo por WhatsApp" />}
            {listo && wa2 && (
              <a href={wa2} target="_blank" rel="noopener noreferrer" className={`${btnPrimary} !bg-emerald-600 hover:!bg-emerald-700`}>Avisar: listo para recibir</a>
            )}
            {antesDeListo && wa1 && (
              <a href={wa1} target="_blank" rel="noopener noreferrer" className={btnGhost}>Reenviar recibo (enviado a hacer)</a>
            )}
            {!wa1 && <p className="text-sm text-amber-700">El paciente no tiene un celular válido para WhatsApp.</p>}
          </div>
          <div>
            <p className="mb-1 text-xs text-brand-dark/60">Enlace de seguimiento del cliente (es exclusivo de este pedido; no necesita cuenta):</p>
            <CopiarEnlace enlace={enlace} />
          </div>
          <p className="text-xs text-brand-dark/60">{auto ? "Los botones verdes envían el mensaje solos; los de abajo abren WhatsApp con el texto escrito (respaldo manual)." : "Los botones abren WhatsApp con el mensaje ya escrito; solo pulsa enviar."}</p>
        </section>
      )}

      <section className={`${card} flex flex-col gap-4`}>
        <div>
          <h2 className="mb-2 font-semibold text-brand">Detalle del pedido</h2>
          <ul className="divide-y divide-brand/10 text-sm">
            {d.items.map((i, k) => (
              <li key={k} className="flex justify-between py-1.5"><span>{i.nombre ?? "Producto"}</span><span className="font-semibold">× {i.cantidad}</span></li>
            ))}
          </ul>
        </div>
        {spec.map((s) => (
          <div key={s.titulo} className="rounded-xl bg-iris-light/40 px-4 py-2 text-sm">
            <p className="font-semibold text-brand">{s.titulo}</p>
            <ul>{s.lineas.map((l) => <li key={l}>{l}</li>)}</ul>
          </div>
        ))}
        {d.notas && <p className="text-sm"><span className="font-semibold text-brand">Notas para el laboratorio:</span> {d.notas}</p>}
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-xs uppercase tracking-wide text-brand-dark/50">Celular</dt><dd>{d.telefono ?? "—"}</dd></div>
          {d.saldo != null && <div><dt className="text-xs uppercase tracking-wide text-brand-dark/50">Saldo pendiente</dt><dd className={d.saldo > 0 ? "font-semibold text-amber-700" : "text-emerald-700"}>{dinero(d.saldo)}</dd></div>}
          <div><dt className="text-xs uppercase tracking-wide text-brand-dark/50">Venta</dt><dd>{user.rol === "doctor" ? "—" : <Link href={`/dashboard/ventas/${d.sale_id}`} className="text-iris hover:underline">Ver venta</Link>}</dd></div>
        </dl>
        {puedeActuar && !entregado && <FechaEntrega ordenId={d.id} valor={d.fecha_entrega} />}
        {(!puedeActuar || entregado) && d.fecha_entrega && <p className="text-sm">Entrega estimada: <strong>{fechaCorta(d.fecha_entrega)}</strong></p>}
      </section>

      <section className={card}>
        <h2 className="mb-2 font-semibold text-brand">Historial</h2>
        <ul className="divide-y divide-brand/10 text-sm">
          {d.historial.map((h, k) => (
            <li key={k} className="flex flex-wrap justify-between gap-2 py-1.5">
              <span className="font-medium">
                {estadoInfo(h.estado)?.label ?? h.estado}
                {k > 0 && indiceEstado(h.estado) < indiceEstado(d.historial[k - 1].estado) && (
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Corrección</span>
                )}
              </span>
              <span className="text-brand-dark/60">{fechaHoraLocal(h.fecha)} · {h.usuario ?? "—"}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
