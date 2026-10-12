import Link from "next/link";
import { notFound } from "next/navigation";
import { ComprobanteDoc, type ComprobanteDatos } from "@/components/comprobante-doc";
import { PrintButton } from "@/components/print-button";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { btnGhost, btnPrimary } from "@/lib/ui";
import { uuid } from "@/lib/validation";

export const metadata = { title: "Comprobante · Óptica Pérez" };

export default async function ComprobantePage({ params }: PageProps<"/dashboard/ventas/[id]/comprobante">) {
  const user = await requireRole("recepcionista", "administrador");
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("sales")
    .select("numero, fecha, subtotal, descuento, total, pagado, estado, vendedor_id, patients(nombre, documento), sale_items(nombre, cantidad, precio_unitario, descuento), sale_payments(monto, metodo, fecha)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) notFound();
  const v = data as unknown as {
    numero: number; fecha: string; subtotal: number; descuento: number; total: number; pagado: number; estado: string; vendedor_id: string;
    patients: { nombre: string; documento: string | null } | null;
    sale_items: ComprobanteDatos["items"];
    sale_payments: ComprobanteDatos["pagos"];
  };
  // Nombre de quien atendio: la recepcionista solo ve su propio perfil (y solo ve sus ventas).
  const { data: u } = await supabase.from("users").select("nombre, email").eq("id", v.vendedor_id).maybeSingle();

  const c: ComprobanteDatos = {
    numero: v.numero,
    fecha: v.fecha,
    paciente: v.patients?.nombre ?? null,
    documento: v.patients?.documento ?? null,
    vendedor: (u?.nombre || u?.email) ?? (user.nombre || null),
    subtotal: v.subtotal,
    descuento: v.descuento,
    total: v.total,
    pagado: v.pagado,
    anulada: v.estado === "anulada",
    items: v.sale_items,
    pagos: [...v.sale_payments].sort((a, b) => a.fecha.localeCompare(b.fecha)),
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/dashboard/ventas/${id}`} className={btnGhost}>← Volver a la venta</Link>
        <PrintButton className={btnPrimary} />
      </div>
      <ComprobanteDoc c={c} />
    </>
  );
}
