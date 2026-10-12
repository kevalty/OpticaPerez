import Image from "next/image";
import { NEGOCIO } from "@/lib/negocio";
import { fechaHoraLocal } from "@/lib/time";

export type OrdenDatos = {
  numeroVenta: number;
  fecha: string;
  fechaEntrega: string | null;
  paciente: string;
  telefono: string | null;
  notas: string | null;
  items: { nombre: string | null; cantidad: number }[];
  saldo: number;
};

// Orden de trabajo para el laboratorio (pagina 1). La hoja RX va en la pagina siguiente.
export function OrdenDoc({ o }: { o: OrdenDatos }) {
  return (
    <article className="mx-auto w-full max-w-[210mm] bg-white px-10 py-8 text-[13px] leading-relaxed text-brand-dark ring-1 ring-brand/10 print:max-w-none print:px-2 print:py-0 print:ring-0">
      <header className="flex items-center gap-5 border-b-2 border-brand pb-3">
        <Image src="/logo-icon.png" alt="Óptica Pérez" width={442} height={384} className="h-auto w-20 shrink-0" />
        <div className="flex-1 text-brand">
          <p className="text-3xl font-extrabold tracking-wide">{NEGOCIO.nombre}</p>
          <p className="text-[11px]">{NEGOCIO.lineas[0]}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-brand-dark/60">Orden de trabajo</p>
          <p className="font-mono text-xl font-bold text-brand">N.º {String(o.numeroVenta).padStart(6, "0")}</p>
        </div>
      </header>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1">
        <div className="flex gap-2"><dt className="text-brand">Paciente:</dt><dd className="font-semibold">{o.paciente}</dd></div>
        <div className="flex gap-2"><dt className="text-brand">Teléfono:</dt><dd>{o.telefono ?? "—"}</dd></div>
        <div className="flex gap-2"><dt className="text-brand">Fecha del pedido:</dt><dd>{fechaHoraLocal(o.fecha)}</dd></div>
        <div className="flex gap-2"><dt className="text-brand">Entrega:</dt><dd className="font-semibold">{o.fechaEntrega ? o.fechaEntrega.split("-").reverse().join("/") : "Por definir"}</dd></div>
      </dl>

      <h2 className="mt-5 w-fit rounded-r-full bg-brand px-4 py-0.5 text-sm font-bold text-white">Trabajo a realizar</h2>
      <ul className="mt-2 divide-y divide-brand/15 border-y border-brand/15">
        {o.items.map((i, k) => (
          <li key={k} className="flex justify-between py-1.5">
            <span>{i.nombre ?? "Producto"}</span>
            <span className="font-semibold">× {i.cantidad}</span>
          </li>
        ))}
      </ul>

      {o.notas && (
        <div className="mt-4">
          <p className="font-semibold text-brand">Notas para el laboratorio</p>
          <p className="whitespace-pre-wrap rounded border border-brand/20 px-3 py-2">{o.notas}</p>
        </div>
      )}

      <p className="mt-6 text-sm">
        Saldo pendiente del cliente: <strong>{o.saldo > 0 ? `$ ${o.saldo.toFixed(2)}` : "ninguno (pagado)"}</strong>
      </p>
      <p className="mt-1 text-xs text-brand-dark/60">La hoja RX con las medidas está en la página siguiente.</p>
    </article>
  );
}
