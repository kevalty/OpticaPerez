import Image from "next/image";
import { NEGOCIO } from "@/lib/negocio";
import { fechaHoraLocal } from "@/lib/time";
import { dinero, metodoLabel } from "@/lib/ventas";

export type ComprobanteDatos = {
  numero: number;
  fecha: string;
  paciente: string | null;
  documento: string | null;
  vendedor: string | null;
  subtotal: number;
  descuento: number;
  total: number;
  pagado: number;
  anulada: boolean;
  items: { nombre: string | null; cantidad: number; precio_unitario: number; descuento: number }[];
  pagos: { monto: number; metodo: string; fecha: string }[];
};

// Comprobante interno de venta. NO es una factura electronica del SRI.
export function ComprobanteDoc({ c }: { c: ComprobanteDatos }) {
  const saldo = Math.round((c.total - c.pagado) * 100) / 100;
  return (
    <article className="mx-auto w-full max-w-[210mm] bg-white px-10 py-8 text-[13px] leading-relaxed text-brand-dark ring-1 ring-brand/10 print:max-w-none print:px-2 print:py-0 print:ring-0">
      <header className="flex items-center gap-5 border-b-2 border-brand pb-3">
        <Image src="/logo-icon.png" alt="Óptica Pérez" width={442} height={384} className="h-auto w-20 shrink-0" />
        <div className="flex-1 text-brand">
          <p className="text-3xl font-extrabold tracking-wide">{NEGOCIO.nombre}</p>
          <p className="text-[11px]">{NEGOCIO.lineas[0]}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-brand-dark/60">Comprobante de venta</p>
          <p className="font-mono text-xl font-bold text-brand">N.º {String(c.numero).padStart(6, "0")}</p>
        </div>
      </header>

      {c.anulada && <p className="mt-3 rounded border border-red-400 px-3 py-1 text-center text-lg font-bold uppercase text-red-700">Anulada</p>}

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1">
        <div className="flex gap-2"><dt className="text-brand">Fecha:</dt><dd>{fechaHoraLocal(c.fecha)}</dd></div>
        <div className="flex gap-2"><dt className="text-brand">Atendió:</dt><dd>{c.vendedor ?? "—"}</dd></div>
        <div className="flex gap-2"><dt className="text-brand">Cliente:</dt><dd>{c.paciente ?? "Consumidor final"}</dd></div>
        <div className="flex gap-2"><dt className="text-brand">Documento:</dt><dd>{c.documento ?? "—"}</dd></div>
      </dl>

      <table className="mt-4 w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-brand text-xs uppercase text-brand">
            <th className="py-1 pr-2 font-semibold">Descripción</th>
            <th className="py-1 pr-2 font-semibold">Cant.</th>
            <th className="py-1 pr-2 text-right font-semibold">P. unit.</th>
            <th className="py-1 pr-2 text-right font-semibold">Desc.</th>
            <th className="py-1 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {c.items.map((i, k) => (
            <tr key={k} className="border-b border-brand/15">
              <td className="py-1.5 pr-2">{i.nombre ?? "Producto"}</td>
              <td className="py-1.5 pr-2">{i.cantidad}</td>
              <td className="py-1.5 pr-2 text-right">{dinero(i.precio_unitario)}</td>
              <td className="py-1.5 pr-2 text-right">{i.descuento > 0 ? dinero(i.descuento) : ""}</td>
              <td className="py-1.5 text-right">{dinero(i.cantidad * i.precio_unitario - i.descuento)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="ml-auto mt-3 flex max-w-xs flex-col gap-1">
        <div className="flex justify-between"><dt>Subtotal</dt><dd>{dinero(c.subtotal)}</dd></div>
        {c.descuento > 0 && <div className="flex justify-between"><dt>Descuento</dt><dd>− {dinero(c.descuento)}</dd></div>}
        <div className="flex justify-between border-t border-brand pt-1 text-lg font-bold text-brand"><dt>Total</dt><dd>{dinero(c.total)}</dd></div>
        <div className="flex justify-between"><dt>Pagado</dt><dd>{dinero(c.pagado)}</dd></div>
        <div className="flex justify-between font-bold"><dt>Saldo pendiente</dt><dd>{dinero(saldo)}</dd></div>
      </dl>

      {c.pagos.length > 0 && (
        <div className="mt-4">
          <p className="font-semibold text-brand">Pagos recibidos</p>
          <ul>
            {c.pagos.map((p, k) => (
              <li key={k} className="flex justify-between border-b border-brand/10 py-0.5">
                <span>{fechaHoraLocal(p.fecha)} · {metodoLabel(p.metodo)}</span>
                <span>{dinero(p.monto)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <footer className="mt-8 text-center text-[11px] text-brand-dark/70">
        <p>Gracias por confiar en Óptica Pérez — en tus ojos desde 1977.</p>
        <p>Comprobante interno, no constituye factura.</p>
      </footer>
    </article>
  );
}
