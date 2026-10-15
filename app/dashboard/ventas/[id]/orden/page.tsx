import Link from "next/link";
import { notFound } from "next/navigation";
import { OrdenDoc, type OrdenDatos } from "@/components/orden-doc";
import { PrintButton } from "@/components/print-button";
import { RecetarioDoc } from "@/components/recetario-doc";
import type { CertificadoDatos } from "@/components/certificado-doc";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { btnGhost, btnPrimary } from "@/lib/ui";
import { uuid } from "@/lib/validation";

export const metadata = { title: "Orden de trabajo · Óptica Pérez" };

type RxOrden = Pick<CertificadoDatos, "fecha" | "paciente" | "tipo_documento" | "documento" | "direccion" | "telefono" | "email" | "recetario"> & { tiene_ficha: boolean; rx?: CertificadoDatos["rx"] };

// Orden de trabajo + hoja RX. La RX llega por rx_orden(): la recepcionista no lee fichas, solo lo que lleva la hoja.
export default async function OrdenPage({ params }: PageProps<"/dashboard/ventas/[id]/orden">) {
  await requireRole("recepcionista", "administrador");
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("sales")
    .select("numero, fecha, total, pagado, patients(nombre, telefono), sale_items(nombre, cantidad), orders(id, fecha_entrega, notas, deleted_at)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) notFound();
  const v = data as unknown as {
    numero: number; fecha: string; total: number; pagado: number;
    patients: { nombre: string; telefono: string | null } | null;
    sale_items: { nombre: string | null; cantidad: number }[];
    orders: { id: string; fecha_entrega: string | null; notas: string | null; deleted_at: string | null }[];
  };
  const orden = v.orders.find((o) => !o.deleted_at);
  if (!orden || !v.patients) notFound();

  const { data: rxData } = await supabase.rpc("rx_orden", { p_orden: orden.id });
  const rx = rxData as RxOrden | null;

  const o: OrdenDatos = {
    numeroVenta: v.numero,
    fecha: v.fecha,
    fechaEntrega: orden.fecha_entrega,
    paciente: v.patients.nombre,
    telefono: v.patients.telefono,
    notas: orden.notas,
    items: v.sale_items,
    saldo: Math.round((v.total - v.pagado) * 100) / 100,
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/dashboard/ventas/${id}`} className={btnGhost}>← Volver a la venta</Link>
        <PrintButton className={btnPrimary} />
      </div>
      {rx && !rx.tiene_ficha && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-brand print:hidden">Este paciente todavía no tiene ficha médica: la hoja RX sale en blanco para llenarla a mano.</p>
      )}
      {rx && rx.tiene_ficha && !rx.recetario && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-brand print:hidden">El doctor no llenó la RX en la última consulta: la hoja sale solo con los datos del paciente.</p>
      )}

      <OrdenDoc o={o} />
      {rx && (
        <div className="break-before-page">
          <RecetarioDoc c={{ ...rx, fechaEntrega: orden.fecha_entrega }} />
        </div>
      )}
    </>
  );
}
