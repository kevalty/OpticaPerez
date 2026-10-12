import Link from "next/link";
import { PosVenta } from "@/components/pos-venta";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { shiftDate, todayISO } from "@/lib/time";
import { uuid } from "@/lib/validation";
import type { Producto } from "@/lib/ventas";

export const metadata = { title: "Nueva venta · Óptica Pérez" };

export default async function NuevaVentaPage({ searchParams }: PageProps<"/dashboard/ventas/nueva">) {
  const user = await requireRole("recepcionista", "administrador");
  const sp = await searchParams;
  const pid = typeof sp.paciente === "string" && uuid.safeParse(sp.paciente).success ? sp.paciente : null;

  const supabase = await createClient();
  const [{ data: prods }, { data: pac }] = await Promise.all([
    supabase.from("products").select("id, nombre, tipo, precio, stock, controla_stock, codigo").is("deleted_at", null).order("tipo").order("nombre"),
    pid ? supabase.from("patients").select("id, nombre, documento").eq("id", pid).is("deleted_at", null).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  return (
    <>
      <div>
        <Link href="/dashboard/ventas" className="text-sm text-iris hover:underline">← Ventas</Link>
        <h1 className="text-2xl font-semibold text-brand">Nueva venta</h1>
      </div>
      <PosVenta
        productos={(prods ?? []) as Producto[]}
        pacienteInicial={(pac as { id: string; nombre: string; documento: string | null } | null) ?? null}
        esAdmin={user.rol === "administrador"}
        entregaSugerida={shiftDate(todayISO(), 7)}
      />
    </>
  );
}
