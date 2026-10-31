import Link from "next/link";
import { UsuarioNombre } from "@/components/usuario-nombre";
import { requireRole } from "@/lib/auth";
import { ESTADOS_PEDIDO, fechaCorta } from "@/lib/pedidos";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { formatDateLong, rangoDia, todayISO } from "@/lib/time";
import { card } from "@/lib/ui";
import { dinero } from "@/lib/ventas";

export const metadata = { title: "Administración · Óptica Pérez" };

type FilaPedido = { id: string; numero: number | null; paciente: string; estado: string; fecha_entrega: string | null; saldo: number | null };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const TABS = [
  { id: "resumen", titulo: "Resumen del día" },
  { id: "usuarios", titulo: "Usuarios" },
] as const;

const ESTADOS_TURNO: { id: string; label: string }[] = [
  { id: "agendado", label: "Agendados" },
  { id: "en_espera", label: "En espera" },
  { id: "en_consulta", label: "En consulta" },
  { id: "atendido", label: "Atendidos" },
  { id: "finalizado", label: "Finalizados" },
];

function Cifra({ valor, titulo, tono = "normal", href, chica }: { valor: string | number; titulo: string; tono?: "normal" | "alerta" | "mal"; href?: string; chica?: boolean }) {
  const color = tono === "mal" ? "text-red-700" : tono === "alerta" ? "text-amber-700" : "text-brand";
  const cuerpo = (
    <>
      <span className={`block break-words font-bold ${chica ? "text-2xl" : "text-3xl"} ${color}`}>{valor}</span>
      <span className="text-sm text-brand-dark/70">{titulo}</span>
    </>
  );
  const cls = "rounded-2xl bg-white p-4 ring-1 ring-brand/10";
  return href ? <Link href={href} className={`${cls} hover:ring-iris/60`}>{cuerpo}</Link> : <div className={cls}>{cuerpo}</div>;
}

// Panel del administrador: resumen del dia (turnos, pedidos, ventas, stock, WhatsApp) y lista de usuarios.
// Todo se lee con la sesion del administrador (RLS). Los usuarios se crean y se activan solo desde Supabase.
export default async function AdminPage({ searchParams }: PageProps<"/dashboard/admin">) {
  await requireRole("administrador");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.id === one(sp.tab))?.id ?? "resumen";
  const supabase = await createClient();
  const hoy = todayISO();

  return (
    <>
      <h1 className="text-2xl font-semibold text-brand">Administración</h1>
      <nav aria-label="Secciones" className="flex gap-2 border-b border-brand/10 pb-3">
        {TABS.map((t) => (
          <Link key={t.id} href={`/dashboard/admin?tab=${t.id}`} aria-current={tab === t.id ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-medium ${tab === t.id ? "bg-brand text-white" : "text-brand hover:bg-iris-light"}`}>{t.titulo}</Link>
        ))}
      </nav>
      {tab === "resumen" ? <Resumen supabase={supabase} hoy={hoy} /> : <Usuarios supabase={supabase} />}
    </>
  );
}

type Cliente = Awaited<ReturnType<typeof createClient>>;

async function Resumen({ supabase, hoy }: { supabase: Cliente; hoy: string }) {
  const { desde, hasta } = rangoDia(hoy);
  const [turnos, pedidos, ventasHoy, saldos, stock, fallos, plantillas] = await Promise.all([
    supabase.from("appointments").select("estado").eq("fecha", hoy).is("deleted_at", null),
    supabase.rpc("lista_pedidos", { p_filtro: "activos" }),
    supabase.from("sales").select("total, pagado").eq("estado", "activa").gte("fecha", desde).lt("fecha", hasta),
    supabase.from("sales").select("total, pagado").eq("estado", "activa").is("deleted_at", null).limit(5000),
    supabase.from("products").select("id, nombre, stock, stock_minimo").eq("controla_stock", true).is("deleted_at", null).order("stock").limit(500),
    supabase.from("whatsapp_envios").select("id", { count: "exact", head: true }).eq("estado", "fallido").gte("created_at", desde).lt("created_at", hasta),
    supabase.from("whatsapp_plantillas").select("tipo").eq("activa", false),
  ]);

  const porEstadoTurno = new Map<string, number>();
  for (const t of (turnos.data ?? []) as { estado: string }[]) porEstadoTurno.set(t.estado, (porEstadoTurno.get(t.estado) ?? 0) + 1);
  const totalTurnos = (turnos.data ?? []).length;

  const activos = (pedidos.data ?? []) as FilaPedido[];
  const atrasados = activos.filter((p) => p.fecha_entrega && p.fecha_entrega < hoy && !["listo_para_recibir", "entregado"].includes(p.estado));
  const listos = activos.filter((p) => p.estado === "listo_para_recibir");

  const v = (ventasHoy.data ?? []) as { total: number; pagado: number }[];
  const vendido = v.reduce((a, x) => a + Number(x.total), 0);
  const cobrado = v.reduce((a, x) => a + Number(x.pagado), 0);
  const conSaldo = ((saldos.data ?? []) as { total: number; pagado: number }[]).filter((x) => Number(x.total) - Number(x.pagado) > 0.004);
  const saldoTotal = conSaldo.reduce((a, x) => a + (Number(x.total) - Number(x.pagado)), 0);

  const productos = (stock.data ?? []) as { id: string; nombre: string; stock: number; stock_minimo: number }[];
  const agotados = productos.filter((p) => p.stock <= 0);
  const bajos = productos.filter((p) => p.stock > 0 && p.stock <= p.stock_minimo);
  const alertas = [...agotados, ...bajos].slice(0, 8);
  const inactivas = (plantillas.data ?? []).length;
  const fallosHoy = fallos.count ?? 0;
  const hayError = [turnos.error, pedidos.error, ventasHoy.error, stock.error].some(Boolean);

  return (
    <>
      {hayError && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Una parte del resumen no se pudo cargar. Si continúa, revisa que las migraciones estén al día.</p>}

      <section className={`${card} flex flex-col gap-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-brand">Turnos de hoy <span className="font-normal text-brand-dark/60">· {formatDateLong(hoy)}</span></h2>
          <Link href="/dashboard/turnos" className="inline-flex min-h-11 items-center text-sm text-iris hover:underline">Ver agenda</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Cifra valor={totalTurnos} titulo="Turnos en total" href="/dashboard/turnos" />
          {ESTADOS_TURNO.map((e) => <Cifra key={e.id} valor={porEstadoTurno.get(e.id) ?? 0} titulo={e.label} tono={e.id === "atendido" && (porEstadoTurno.get("atendido") ?? 0) > 0 ? "alerta" : "normal"} />)}
        </div>
        {(porEstadoTurno.get("atendido") ?? 0) > 0 && (
          <Link href="/dashboard/turnos" className="inline-flex min-h-11 items-center rounded-xl bg-amber-50 px-4 text-sm text-amber-800">
            <strong className="mr-1">{porEstadoTurno.get("atendido")}</strong> paciente{porEstadoTurno.get("atendido") === 1 ? "" : "s"} atendido{porEstadoTurno.get("atendido") === 1 ? "" : "s"} esperando pasar por recepción (certificado y cierre) →
          </Link>
        )}
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-brand">Pedidos pendientes</h2>
          <Link href="/dashboard/pedidos" className="inline-flex min-h-11 items-center text-sm text-iris hover:underline">Ver pedidos</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Cifra valor={activos.length} titulo="Sin entregar" href="/dashboard/pedidos?filtro=activos" />
          {ESTADOS_PEDIDO.filter((e) => e.id !== "entregado").map((e) => <Cifra key={e.id} valor={activos.filter((p) => p.estado === e.id).length} titulo={e.label} />)}
        </div>
        {listos.length > 0 && <p className="text-sm text-emerald-700"><strong>{listos.length}</strong> listo{listos.length === 1 ? "" : "s"} para recibir: el cliente puede pasar a retirar.</p>}
        {atrasados.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-semibold text-red-700">{atrasados.length} atrasado{atrasados.length === 1 ? "" : "s"} (pasó la fecha de entrega)</p>
            <ul className="divide-y divide-brand/10 text-sm">
              {atrasados.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <Link href={`/dashboard/pedidos/${p.id}`} className="flex flex-wrap justify-between gap-2 py-2 hover:bg-iris-light/50">
                    <span><span className="font-mono text-brand-dark/60">N.º {String(p.numero ?? 0).padStart(6, "0")}</span> <span className="font-medium text-brand">{p.paciente}</span></span>
                    <span className="text-red-700">entrega {fechaCorta(p.fecha_entrega!)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className={`${card} flex flex-col gap-3`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-brand">Ventas de hoy</h2>
            <Link href="/dashboard/ventas" className="inline-flex min-h-11 items-center text-sm text-iris hover:underline">Ver ventas</Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Cifra valor={dinero(vendido)} titulo="Vendido" chica />
            <Cifra valor={dinero(cobrado)} titulo="Cobrado" chica />
            <Cifra valor={v.length} titulo="Ventas" href="/dashboard/ventas" />
            <Cifra valor={dinero(Math.max(0, vendido - cobrado))} titulo="Por cobrar de hoy" tono={vendido - cobrado > 0.004 ? "alerta" : "normal"} chica />
          </div>
          <Link href="/dashboard/ventas?saldo=1" className={`rounded-xl px-4 py-3 text-sm ${conSaldo.length > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
            {conSaldo.length > 0 ? <>Saldos pendientes: <strong>{dinero(saldoTotal)}</strong> en {conSaldo.length} venta{conSaldo.length === 1 ? "" : "s"}.</> : "No hay saldos pendientes."}
          </Link>
        </div>

        <div className={`${card} flex flex-col gap-3`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-brand">Alertas de stock</h2>
            <Link href="/dashboard/inventario" className="inline-flex min-h-11 items-center text-sm text-iris hover:underline">Ver inventario</Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Cifra valor={agotados.length} titulo="Agotados" tono={agotados.length > 0 ? "mal" : "normal"} href="/dashboard/inventario?f=agotado" />
            <Cifra valor={bajos.length} titulo="Stock bajo" tono={bajos.length > 0 ? "alerta" : "normal"} href="/dashboard/inventario?f=bajo" />
          </div>
          {alertas.length === 0 ? <p className="text-sm text-emerald-700">Todo el stock está por encima del mínimo.</p> : (
            <ul className="divide-y divide-brand/10 text-sm">
              {alertas.map((p) => (
                <li key={p.id} className="flex justify-between gap-2 py-1.5">
                  <span className="text-brand">{p.nombre}</span>
                  <span className={p.stock <= 0 ? "font-semibold text-red-700" : "text-amber-700"}>{p.stock <= 0 ? "Agotado" : `Quedan ${p.stock} (mín. ${p.stock_minimo})`}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {(inactivas > 0 || fallosHoy > 0) && (
        <section className={`${card} flex flex-col gap-1`}>
          <h2 className="font-semibold text-brand">WhatsApp</h2>
          {fallosHoy > 0 && <p className="text-sm text-red-700">{fallosHoy} envío{fallosHoy === 1 ? "" : "s"} fallido{fallosHoy === 1 ? "" : "s"} hoy. <Link href="/dashboard/whatsapp?tab=historial" className="underline">Ver historial</Link></p>}
          {inactivas > 0 && <p className="text-sm text-amber-700">{inactivas} plantilla{inactivas === 1 ? "" : "s"} sin activar. <Link href="/dashboard/whatsapp?tab=plantillas" className="underline">Revisar plantillas</Link></p>}
        </section>
      )}
    </>
  );
}

async function Usuarios({ supabase }: { supabase: Cliente }) {
  const { data, error } = await supabase.from("users").select("id, nombre, email, rol, activo").is("deleted_at", null).order("nombre");
  if (error) console.error("usuarios fallo:", error.code);
  const usuarios = (data ?? []) as { id: string; nombre: string; email: string; rol: Role; activo: boolean }[];

  return (
    <>
      <p className="rounded-xl bg-iris-light/50 px-4 py-3 text-sm text-brand">
        Por seguridad, los usuarios se <strong>crean, activan y cambian de rol únicamente desde Supabase</strong>. Aquí solo puedes corregir el nombre que se muestra en la app y en los comprobantes.
      </p>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo cargar la lista de usuarios.</p>}
      <section className={`${card} divide-y divide-brand/10 p-0`}>
        {usuarios.length === 0 ? <p className="p-5 text-sm text-brand-dark/70">No hay usuarios.</p> : usuarios.map((u) => (
          <div key={u.id} className="flex flex-col gap-2 px-5 py-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="break-all text-brand-dark/70">{u.email}</span>
              <span className="rounded-full bg-iris-light px-2.5 py-0.5 text-xs font-semibold text-brand">{ROLE_LABEL[u.rol] ?? u.rol}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.activo ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>{u.activo ? "Activo" : "Inactivo"}</span>
            </div>
            <UsuarioNombre id={u.id} nombre={u.nombre} />
          </div>
        ))}
      </section>
    </>
  );
}
