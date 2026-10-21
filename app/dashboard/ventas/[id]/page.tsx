import Link from "next/link";
import { notFound } from "next/navigation";
import { AbonoForm, AnularForm } from "@/components/abono-form";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fechaHoraLocal } from "@/lib/time";
import { btnGhost, btnPrimary, card } from "@/lib/ui";
import { uuid } from "@/lib/validation";
import { estadoInfo, fechaCorta } from "@/lib/pedidos";
import { enlaceSeguimiento, siteUrl } from "@/lib/site";
import { dinero, metodoLabel } from "@/lib/ventas";
import { mensajeRecibo, waLink } from "@/lib/whatsapp";

export const metadata = { title: "Venta · Óptica Pérez" };

type Venta = {
  id: string; numero: number; fecha: string; subtotal: number; descuento: number; total: number; pagado: number; estado: string;
  observaciones: string | null; anulada_motivo: string | null; vendedor_id: string; patient_id: string | null;
  patients: { nombre: string; documento: string | null; telefono: string | null } | null;
  sale_items: { id: string; nombre: string | null; cantidad: number; precio_unitario: number; descuento: number }[];
  sale_payments: { id: string; monto: number; metodo: string; nota: string | null; fecha: string }[];
  orders: { id: string; estado: string; fecha_entrega: string | null; token: string; deleted_at: string | null }[];
};
const num = (n: number) => String(n).padStart(6, "0");

export default async function VentaPage({ params, searchParams }: PageProps<"/dashboard/ventas/[id]">) {
  const user = await requireRole("recepcionista", "administrador");
  const { id } = await params;
  const sp = await searchParams;
  if (!uuid.safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales")
    .select(
      "id, numero, fecha, subtotal, descuento, total, pagado, estado, observaciones, anulada_motivo, vendedor_id, patient_id, patients(nombre, documento, telefono), sale_items(id, nombre, cantidad, precio_unitario, descuento), sale_payments(id, monto, metodo, nota, fecha), orders(id, estado, fecha_entrega, token, deleted_at)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) console.error("venta fallo:", error.code);
  if (error && !data) {
    // Un error de la base (p. ej. migracion pendiente) no es "pagina no encontrada".
    return (
      <>
        <Link href="/dashboard/ventas" className={btnGhost}>← Ventas</Link>
        <p role="alert" className="max-w-xl rounded-xl bg-amber-50 px-4 py-3 text-sm text-brand">
          No se pudo cargar la venta. Si el problema continúa, avisa al administrador (puede faltar actualizar la base de datos: migraciones 0011 y 0012).
        </p>
      </>
    );
  }
  if (!data) notFound();
  const v = data as unknown as Venta;
  const saldo = Math.round((v.total - v.pagado) * 100) / 100;
  const orden = v.orders.find((o) => !o.deleted_at) ?? null;
  const anulada = v.estado === "anulada";
  // Recibo por WhatsApp (primer mensaje): enlace de seguimiento exclusivo del pedido.
  const waRecibo =
    orden && v.patients
      ? waLink(v.patients.telefono, mensajeRecibo({ nombre: v.patients.nombre.trim().split(" ")[0], numero: v.numero, link: enlaceSeguimiento(await siteUrl(), orden.token) }))
      : null;
  const pagos = [...v.sale_payments].sort((a, b) => a.fecha.localeCompare(b.fecha));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link href="/dashboard/ventas" className="inline-flex min-h-11 items-center text-sm text-iris hover:underline">← Ventas</Link>
          <h1 className="text-2xl font-semibold text-brand">Venta N.º {num(v.numero)}</h1>
          <p className="text-sm text-brand-dark/70">{fechaHoraLocal(v.fecha)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/ventas/${v.id}/comprobante`} className={btnPrimary}>Imprimir comprobante</Link>
          {orden && <Link href={`/dashboard/ventas/${v.id}/orden`} className={btnGhost}>Imprimir orden + RX</Link>}
          {orden && <Link href={`/dashboard/pedidos/${orden.id}`} className={btnGhost}>Ver pedido</Link>}
        </div>
      </div>

      {sp.ok === "venta" && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Venta registrada. Ya puedes imprimir el comprobante{orden ? " y la orden de trabajo" : ""}.</p>}
      {orden && !anulada && (
        <section className="flex flex-col gap-2 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200 print:hidden">
          <p className="text-sm font-semibold text-emerald-900">Envía el recibo al cliente por WhatsApp</p>
          <p className="text-xs text-emerald-900/80">Lleva su enlace de seguimiento: verá «enviado a hacer» y cómo avanza hasta que esté listo.</p>
          {waRecibo ? (
            <a href={waRecibo} target="_blank" rel="noopener noreferrer" className={`${btnPrimary} !bg-emerald-600 hover:!bg-emerald-700 w-fit`}>Enviar recibo por WhatsApp</a>
          ) : (
            <p className="text-sm text-amber-700">El paciente no tiene un celular válido: corrígelo en «Editar datos» del paciente.</p>
          )}
        </section>
      )}
      {anulada && <p role="alert" className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700"><strong>Venta anulada.</strong> Motivo: {v.anulada_motivo}</p>}

      <section className={card}>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
          <div><dt className="text-xs uppercase tracking-wide text-brand-dark/50">Paciente</dt><dd>{v.patients ? <Link href={`/dashboard/pacientes/${v.patient_id}`} className="text-brand hover:underline">{v.patients.nombre}</Link> : "Venta de mostrador"}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-brand-dark/50">Celular</dt><dd>{v.patients?.telefono ?? "—"}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-brand-dark/50">Orden de trabajo</dt><dd>{orden ? `${estadoInfo(orden.estado)?.label ?? orden.estado}${orden.fecha_entrega ? ` · entrega ${fechaCorta(orden.fecha_entrega)}` : ""}` : (v.estado === "anulada" ? "Sin orden activa (la venta fue anulada)" : "No se generó")}</dd></div>
        </dl>
        {v.observaciones && <p className="mt-3 text-sm text-brand-dark/80">Observaciones: {v.observaciones}</p>}
      </section>

      <section className={card}>
        <h2 className="mb-2 font-semibold text-brand">Detalle</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead><tr className="text-xs uppercase tracking-wide text-brand-dark/50"><th className="py-1 pr-2 font-medium">Producto</th><th className="py-1 pr-2 font-medium">Cant.</th><th className="py-1 pr-2 text-right font-medium">P. unit.</th><th className="py-1 pr-2 text-right font-medium">Desc.</th><th className="py-1 text-right font-medium">Total</th></tr></thead>
            <tbody className="divide-y divide-brand/10">
              {v.sale_items.map((i) => (
                <tr key={i.id}>
                  <td className="py-1.5 pr-2 text-brand">{i.nombre ?? "Producto"}</td>
                  <td className="py-1.5 pr-2">{i.cantidad}</td>
                  <td className="py-1.5 pr-2 text-right">{dinero(i.precio_unitario)}</td>
                  <td className="py-1.5 pr-2 text-right">{i.descuento > 0 ? `− ${dinero(i.descuento)}` : "—"}</td>
                  <td className="py-1.5 text-right font-medium">{dinero(i.cantidad * i.precio_unitario - i.descuento)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="mt-3 ml-auto flex max-w-xs flex-col gap-1 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{dinero(v.subtotal)}</dd></div>
          {v.descuento > 0 && <div className="flex justify-between"><dt>Descuento</dt><dd>− {dinero(v.descuento)}</dd></div>}
          <div className="flex justify-between border-t border-brand/10 pt-1 text-lg font-bold text-brand"><dt>Total</dt><dd>{dinero(v.total)}</dd></div>
          <div className="flex justify-between"><dt>Pagado</dt><dd>{dinero(v.pagado)}</dd></div>
          <div className={`flex justify-between font-semibold ${saldo > 0 ? "text-amber-700" : "text-emerald-700"}`}><dt>Saldo pendiente</dt><dd>{dinero(saldo)}</dd></div>
        </dl>
      </section>

      <section className={card}>
        <h2 className="mb-2 font-semibold text-brand">Pagos</h2>
        {pagos.length === 0 ? (
          <p className="text-sm text-brand-dark/70">Aún no hay pagos registrados.</p>
        ) : (
          <ul className="divide-y divide-brand/10 text-sm">
            {pagos.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{fechaHoraLocal(p.fecha)} · {metodoLabel(p.metodo)}{p.nota ? ` · ${p.nota}` : ""}</span>
                <span className="font-medium">{dinero(p.monto)}</span>
              </li>
            ))}
          </ul>
        )}
        {!anulada && saldo > 0 && (
          <div id="abono" className="mt-4 scroll-mt-4 border-t border-brand/10 pt-4">
            <h3 className="mb-2 text-sm font-semibold text-brand">Registrar abono o pago del saldo</h3>
            <AbonoForm ventaId={v.id} saldo={saldo} />
          </div>
        )}
      </section>

      {user.rol === "administrador" && !anulada && (
        <section className="rounded-2xl border border-red-200 p-4 print:hidden">
          <h2 className="mb-2 text-sm font-semibold text-red-700">Anular venta (solo administrador)</h2>
          <AnularForm ventaId={v.id} />
        </section>
      )}
    </>
  );
}
