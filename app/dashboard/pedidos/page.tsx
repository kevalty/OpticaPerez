import Link from "next/link";
import { ListaPedidos, type FilaPedido } from "@/components/lista-pedidos";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/time";
import { btnGhost } from "@/lib/ui";

export const metadata = { title: "Pedidos · Óptica Pérez" };

const FILTROS = [
  { id: "activos", label: "En proceso" },
  { id: "listos", label: "Listos para recibir" },
  { id: "entregados", label: "Entregados" },
  { id: "todos", label: "Todos" },
] as const;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function PedidosPage({ searchParams }: PageProps<"/dashboard/pedidos">) {
  await requireRole("recepcionista", "doctor", "administrador");
  const sp = await searchParams;
  const filtro = FILTROS.find((f) => f.id === one(sp.filtro))?.id ?? "activos";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lista_pedidos", { p_filtro: filtro });
  if (error) console.error("lista_pedidos fallo:", error.code);
  const pedidos = (data ?? []) as FilaPedido[];

  return (
    <>
      <h1 className="text-2xl font-semibold text-brand">Pedidos</h1>
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <Link key={f.id} href={`/dashboard/pedidos?filtro=${f.id}`} aria-current={filtro === f.id ? "page" : undefined} className={`${btnGhost} ${filtro === f.id ? "!border-brand !bg-brand !text-white" : ""}`}>
            {f.label}
          </Link>
        ))}
      </div>
      {error && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-brand">No se pudo cargar los pedidos. Si el problema continúa, avisa al administrador (puede faltar actualizar la base de datos: migraciones 0011 y 0012).</p>}
      <ListaPedidos pedidos={pedidos} hoy={todayISO()} />
    </>
  );
}
