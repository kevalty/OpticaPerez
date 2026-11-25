import Link from "next/link";
import { requireRole } from "@/lib/auth";
import {
  ACCION_ETIQUETA,
  FUNCIONES_PUBLICAS_PREVISTAS,
  TABLA_ETIQUETA,
  hrefRegistro,
  rangosAuditoria,
  type RegistroAuditoria,
  type RevisionSeguridad,
} from "@/lib/auditoria";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { fechaHoraLocal, isISODate, shiftDate, todayISO } from "@/lib/time";
import { btnGhost, card, inputCls } from "@/lib/ui";
import { cleanSearch, uuid } from "@/lib/validation";

export const metadata = { title: "Auditoría · Óptica Pérez" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const TABS = [
  { id: "registros", titulo: "Quién hizo qué" },
  { id: "seguridad", titulo: "Revisión de seguridad" },
] as const;
const COLOR_ACCION: Record<string, string> = { ver: "bg-iris-light text-brand", crear: "bg-emerald-100 text-emerald-800", editar: "bg-amber-100 text-amber-800", eliminar: "bg-red-100 text-red-700" };

// Auditoria (solo administrador): quien vio, creo o edito fichas, pacientes, ventas, pedidos, productos y usuarios; y revision automatica de seguridad.
export default async function AuditoriaPage({ searchParams }: PageProps<"/dashboard/auditoria">) {
  await requireRole("administrador");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.id === one(sp.tab))?.id ?? "registros";
  const supabase = await createClient();

  return (
    <>
      <h1 className="text-2xl font-semibold text-brand">Auditoría</h1>
      <nav aria-label="Secciones" className="flex flex-wrap gap-2 border-b border-brand/10 pb-3">
        {TABS.map((t) => (
          <Link key={t.id} href={`/dashboard/auditoria?tab=${t.id}`} aria-current={tab === t.id ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-medium ${tab === t.id ? "bg-brand text-white" : "text-brand hover:bg-iris-light"}`}>{t.titulo}</Link>
        ))}
      </nav>
      {tab === "registros" ? <Registros supabase={supabase} sp={sp} /> : <Seguridad supabase={supabase} />}
    </>
  );
}

type Cliente = Awaited<ReturnType<typeof createClient>>;

async function Registros({ supabase, sp }: { supabase: Cliente; sp: Record<string, string | string[] | undefined> }) {
  const hoy = todayISO();
  const desde = isISODate(one(sp.desde)) ? (one(sp.desde) as string) : shiftDate(hoy, -6);
  const hasta = isISODate(one(sp.hasta)) ? (one(sp.hasta) as string) : hoy;
  const tabla = Object.keys(TABLA_ETIQUETA).includes(one(sp.tabla) ?? "") ? (one(sp.tabla) as string) : "";
  const accion = Object.keys(ACCION_ETIQUETA).includes(one(sp.accion) ?? "") ? (one(sp.accion) as string) : "";
  const usuario = uuid.safeParse(one(sp.usuario)).success ? (one(sp.usuario) as string) : "";
  const q = cleanSearch(sp.q);
  const limite = Math.min(1000, Math.max(100, Number(one(sp.max)) || 200));

  const [{ data, error }, { data: users }] = await Promise.all([
    supabase.rpc("auditoria_registros", { p_desde: desde <= hasta ? desde : hasta, p_hasta: desde <= hasta ? hasta : desde, p_tabla: tabla || null, p_accion: accion || null, p_usuario: usuario || null, p_q: q || null, p_limite: limite }),
    supabase.from("users").select("id, nombre, email").is("deleted_at", null).order("nombre"),
  ]);
  const filas = (data ?? []) as RegistroAuditoria[];
  const qs = new URLSearchParams({ tab: "registros", desde, hasta, ...(tabla && { tabla }), ...(accion && { accion }), ...(usuario && { usuario }), ...(q && { q }) }).toString();
  const msg = error ? (error.code === "P0001" ? error.message : error.code === "42883" || error.code === "PGRST202" ? "Falta actualizar la base de datos (migración 0024). Avisa al administrador." : "No se pudo cargar la auditoría.") : null;
  if (error) console.error("auditoria fallo:", error.code);

  return (
    <>
      <section className={`${card} flex flex-col gap-3`}>
        <div className="flex flex-wrap gap-2">
          {rangosAuditoria(hoy).map((r) => (
            <Link key={r.id} href={`/dashboard/auditoria?tab=registros&desde=${r.desde}&hasta=${r.hasta}`} className={`inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-medium ${r.desde === desde && r.hasta === hasta ? "bg-brand text-white" : "text-brand ring-1 ring-brand/15 hover:bg-iris-light"}`}>{r.label}</Link>
          ))}
        </div>
        <form action="/dashboard/auditoria" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <input type="hidden" name="tab" value="registros" />
          <label className="flex flex-col gap-1 text-sm font-medium text-brand">Desde<input type="date" name="desde" defaultValue={desde} className={inputCls} /></label>
          <label className="flex flex-col gap-1 text-sm font-medium text-brand">Hasta<input type="date" name="hasta" defaultValue={hasta} className={inputCls} /></label>
          <label className="flex flex-col gap-1 text-sm font-medium text-brand">Paciente
            <input name="q" defaultValue={q} placeholder="Nombre del paciente" maxLength={60} autoComplete="off" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-brand">Qué
            <select name="tabla" defaultValue={tabla} className={inputCls}>
              <option value="">Todo</option>
              {Object.entries(TABLA_ETIQUETA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-brand">Acción
            <select name="accion" defaultValue={accion} className={inputCls}>
              <option value="">Todas</option>
              {Object.entries(ACCION_ETIQUETA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-brand">Usuario
            <select name="usuario" defaultValue={usuario} className={inputCls}>
              <option value="">Todos</option>
              {((users ?? []) as { id: string; nombre: string; email: string }[]).map((u) => <option key={u.id} value={u.id}>{u.nombre || u.email}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3">
            <button className={`${btnGhost} !min-h-11`}>Filtrar</button>
            {!error && <Link href={`/dashboard/auditoria/csv?${qs}`} prefetch={false} className={btnGhost}>Descargar CSV</Link>}
          </div>
        </form>
      </section>

      {msg && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{msg}</p>}
      {!msg && (
        <section className={card}>
          {filas.length === 0 ? <p className="text-sm text-brand-dark/70">No hay registros con estos filtros.</p> : (
            <ul className="divide-y divide-brand/10 text-sm">
              {filas.map((f) => {
                const href = hrefRegistro(f.tabla, f.registro_id);
                const que = TABLA_ETIQUETA[f.tabla] ?? f.tabla;
                return (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${COLOR_ACCION[f.accion] ?? ""}`}>{ACCION_ETIQUETA[f.accion] ?? f.accion}</span>
                      {href ? <Link href={href} className="font-medium text-brand underline decoration-brand/30 underline-offset-2">{que}</Link> : <span className="font-medium text-brand">{que}</span>}
                      {f.paciente && <span className="text-brand-dark/70">de {f.paciente}</span>}
                    </span>
                    <span className="text-brand-dark/60">
                      <strong className="font-medium text-brand">{f.usuario}</strong>{f.rol ? ` (${ROLE_LABEL[f.rol as Role] ?? f.rol})` : ""} · {fechaHoraLocal(f.created_at)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {filas.length >= limite && limite < 1000 && (
            <p className="mt-3"><Link href={`/dashboard/auditoria?${qs}&max=${Math.min(1000, limite * 2)}`} className={btnGhost}>Mostrar más</Link></p>
          )}
          <p className="mt-3 text-xs text-brand-dark/60">
            La bitácora solo se agrega: nadie puede editarla ni borrarla desde la aplicación. Guarda quién, qué y cuándo; nunca el contenido clínico. «Sistema / cliente (enlace)» es una confirmación hecha por el cliente desde su enlace.
          </p>
        </section>
      )}
    </>
  );
}

function Punto({ ok, titulo, detalle, lista }: { ok: boolean; titulo: string; detalle: string; lista?: string[] }) {
  return (
    <li className={`flex gap-3 rounded-xl px-4 py-3 ${ok ? "bg-emerald-50" : "bg-amber-50"}`}>
      <span aria-hidden className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${ok ? "bg-emerald-600" : "bg-amber-500"}`}>{ok ? "✓" : "!"}</span>
      <div className="min-w-0">
        <p className="font-medium text-brand">{titulo}</p>
        <p className="text-sm text-brand-dark/70">{detalle}</p>
        {lista && lista.length > 0 && <p className="mt-1 break-words font-mono text-xs text-brand-dark/80">{lista.join(", ")}</p>}
      </div>
    </li>
  );
}

async function Seguridad({ supabase }: { supabase: Cliente }) {
  const { data, error } = await supabase.rpc("revision_seguridad");
  if (error) console.error("revision_seguridad fallo:", error.code);
  const r = data as RevisionSeguridad | null;
  if (!r) return <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">No se pudo hacer la revisión (puede faltar la migración 0024). Avisa al administrador.</p>;

  const inesperadas = r.funciones_publicas.filter((f) => !FUNCIONES_PUBLICAS_PREVISTAS.includes(f));
  const sinPoliticas = r.tablas_sin_politicas.filter((t) => t !== "login_attempts"); // login_attempts: sin politicas a proposito (solo por funciones)
  return (
    <>
      <p className="text-sm text-brand-dark/70">Revisión automática de la base de datos, hecha en este momento. Cada punto debe estar en verde.</p>
      <ul className="flex flex-col gap-2">
        <Punto ok={r.tablas_sin_rls.length === 0} titulo={`Protección por filas (RLS) en las ${r.tablas} tablas`} detalle={r.tablas_sin_rls.length === 0 ? "Todas las tablas tienen RLS activo: cada rol solo ve lo que le corresponde." : "Hay tablas sin RLS: cualquiera con sesión podría leerlas."} lista={r.tablas_sin_rls} />
        <Punto ok={sinPoliticas.length === 0} titulo="Reglas de acceso definidas" detalle={sinPoliticas.length === 0 ? "Toda tabla con RLS tiene sus reglas (login_attempts no las necesita: solo se usa por funciones internas)." : "Hay tablas con RLS pero sin reglas: nadie puede usarlas."} lista={sinPoliticas} />
        <Punto ok={r.tablas_con_acceso_anonimo.length === 0} titulo="Sin acceso público a tablas" detalle={r.tablas_con_acceso_anonimo.length === 0 ? "Ninguna tabla es accesible sin iniciar sesión." : "Estas tablas tienen permisos para visitantes sin sesión (la RLS los frena, pero conviene quitarlos)."} lista={r.tablas_con_acceso_anonimo} />
        <Punto ok={inesperadas.length === 0} titulo="Funciones públicas solo las previstas" detalle={inesperadas.length === 0 ? "Sin sesión solo se puede usar el seguimiento del cliente, su confirmación de entrega y el control del inicio de sesión." : "Estas funciones se pueden ejecutar sin iniciar sesión y no estaban previstas."} lista={inesperadas.length ? inesperadas : r.funciones_publicas} />
        <Punto ok={r.funciones_sin_search_path.length === 0} titulo="Funciones internas protegidas" detalle={r.funciones_sin_search_path.length === 0 ? "Todas las funciones con permisos especiales fijan su ruta de búsqueda (evita suplantación de objetos)." : "Funciones con permisos especiales sin ruta de búsqueda fija."} lista={r.funciones_sin_search_path} />
        <Punto ok={r.buckets_publicos.length === 0} titulo="Fotos y archivos privados" detalle={r.buckets_publicos.length === 0 ? "Ningún almacenamiento de archivos es público: las fotos solo se ven con sesión o con el enlace del pedido." : "Estos almacenamientos son públicos."} lista={r.buckets_publicos} />
        <Punto ok={r.administradores_activos >= 1 && r.administradores_activos <= 3} titulo={`Administradores activos: ${r.administradores_activos}`} detalle={r.administradores_activos < 1 ? "No hay ningún administrador activo." : r.administradores_activos > 3 ? "Hay muchos administradores: conviene dejar solo los necesarios." : `De ${r.usuarios_activos} usuarios activos. Mantén pocos administradores.`} />
      </ul>
      <section className={`${card} text-sm text-brand-dark/80`}>
        <h2 className="mb-1 font-semibold text-brand">Prueba de permisos por rol</h2>
        <p>
          El archivo <code className="rounded bg-iris-light/60 px-1">supabase/tests/permisos.sql</code> comprueba, con usuarios reales de cada rol, que la recepcionista no lee fichas médicas, el doctor no ve ventas ni WhatsApp, solo el administrador accede a reportes, auditoría y ajustes de stock, y que un visitante sin sesión no toca ninguna tabla. Pégalo en el SQL Editor de Supabase; no modifica datos.
        </p>
      </section>
    </>
  );
}
