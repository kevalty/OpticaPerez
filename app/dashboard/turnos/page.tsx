import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { ConfirmButton } from "@/components/confirm-button";
import { requireRole } from "@/lib/auth";
import { mensajeSeguro } from "@/lib/mensajes";
import { cargarFichas } from "@/lib/fichas-server";
import { createClient } from "@/lib/supabase/server";
import { formatDateLong, isISODate, shiftDate, todayISO } from "@/lib/time";
import { btnGhost, btnPrimary, card } from "@/lib/ui";
import { uuid } from "@/lib/validation";
import { cancelarTurno, finalizarTurno, guardarFicha, iniciarConsulta, llegoPaciente } from "./actions";
import { ConsultaModal, type PacienteConsulta } from "./consulta-modal";

export const metadata = { title: "Turnos · Óptica Pérez" };

type Estado = "agendado" | "en_espera" | "en_consulta" | "atendido" | "finalizado";
type Turno = {
  id: string;
  hora: string | null;
  estado: Estado;
  optometrista_id: string | null;
  patient_id: string;
  patients: { nombre: string } | null;
};

const ESTADOS: { id: Estado; label: string; cls: string }[] = [
  { id: "agendado", label: "Agendado", cls: "bg-slate-100 text-slate-700" },
  { id: "en_espera", label: "En espera", cls: "bg-amber-100 text-amber-800" },
  { id: "en_consulta", label: "En consulta", cls: "bg-iris-light text-brand" },
  { id: "atendido", label: "Atendido", cls: "bg-emerald-100 text-emerald-800" },
  { id: "finalizado", label: "Finalizado", cls: "bg-slate-100 text-slate-500" },
];

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function TurnosPage({ searchParams }: PageProps<"/dashboard/turnos">) {
  const user = await requireRole("recepcionista", "doctor", "administrador");
  const sp = await searchParams;
  const hoy = todayISO();
  const fechaParam = one(sp.fecha);
  const fecha = isISODate(fechaParam) ? fechaParam : hoy;
  const esDoctor = user.rol === "doctor" || user.rol === "administrador";
  const esRecep = user.rol === "recepcionista" || user.rol === "administrador";
  const consultaId = esDoctor && uuid.safeParse(one(sp.consulta)).success ? (one(sp.consulta) as string) : null;
  const volverHref = `/dashboard/turnos${fecha !== hoy ? `?fecha=${fecha}` : ""}`;

  const supabase = await createClient();
  const [{ data, error }, { data: opts }, { data: proximos }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, hora, estado, optometrista_id, patient_id, patients(nombre)")
      .eq("fecha", fecha)
      .is("deleted_at", null)
      .order("hora", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase.rpc("list_optometristas"),
    esRecep
      ? supabase
          .from("appointments")
          .select("fecha")
          .gt("fecha", fecha)
          .eq("estado", "agendado")
          .is("deleted_at", null)
          .order("fecha", { ascending: true })
          .limit(300)
      : Promise.resolve({ data: [] }),
  ]);
  const turnos = (data ?? []) as unknown as Turno[];
  const nombreOpt = new Map(((opts ?? []) as { id: string; nombre: string }[]).map((o) => [o.id, o.nombre]));

  const porDia = new Map<string, number>();
  for (const r of (proximos ?? []) as { fecha: string }[]) porDia.set(r.fecha, (porDia.get(r.fecha) ?? 0) + 1);
  const proximosDias = [...porDia.entries()].slice(0, 10);

  // ---- Pop-up de consulta (solo doctor / administrador, y solo si el turno es suyo y esta en consulta) ----
  let modal: React.ReactNode = null;
  if (consultaId) {
    const turno = turnos.find((t) => t.id === consultaId);
    const esMio = turno && turno.estado === "en_consulta" && (turno.optometrista_id === user.id || user.rol === "administrador");
    if (esMio) {
      const { data: p } = await supabase
        .from("patients")
        .select("id, nombre, tipo_documento, documento, telefono, edad, ocupacion, direccion")
        .eq("id", turno.patient_id)
        .maybeSingle();
      if (p) {
        const fichas = await cargarFichas(supabase, p.id, 5);
        modal = (
          <ConsultaModal
            paciente={p as PacienteConsulta}
            fichas={fichas}
            nombreOpt={nombreOpt}
            cerrarHref={volverHref}
            action={guardarFicha.bind(null, consultaId, fecha)}
          />
        );
      }
    }
  }

  const hidden = (t: Turno) => (
    <>
      <input type="hidden" name="id" value={t.id} />
      <input type="hidden" name="fecha" value={fecha} />
    </>
  );

  return (
    <>
      {!modal && <AutoRefresh seconds={15} />}
      {modal}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-brand">Turnos</h1>
        {esRecep && (
          <Link href="/dashboard/turnos/nuevo" className={btnPrimary}>
            + Dar turno
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/dashboard/turnos?fecha=${shiftDate(fecha, -1)}`} className={btnGhost} aria-label="Día anterior">←</Link>
        <p className="min-w-56 text-center font-medium first-letter:uppercase text-brand">{formatDateLong(fecha)}</p>
        <Link href={`/dashboard/turnos?fecha=${shiftDate(fecha, 1)}`} className={btnGhost} aria-label="Día siguiente">→</Link>
        <form action="/dashboard/turnos" className="flex items-center gap-2">
          <input type="date" name="fecha" defaultValue={fecha} aria-label="Ir a una fecha" className="rounded-lg border border-brand/20 bg-white px-2 py-1.5 text-sm text-brand-dark" />
          <button className={btnGhost}>Ir</button>
        </form>
        {fecha !== hoy && <Link href="/dashboard/turnos" className={btnGhost}>Hoy</Link>}
      </div>

      {sp.ok === "ficha" && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Ficha guardada. El turno pasó a “Atendido” y recepción ya lo ve.
        </p>
      )}
      {(mensajeSeguro(sp.error) || error) && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {mensajeSeguro(sp.error) ?? "No se pudo cargar la agenda. Inténtalo de nuevo."}
        </p>
      )}

      <div className="flex flex-wrap gap-2 text-sm">
        {ESTADOS.map((e) => (
          <span key={e.id} className={`rounded-full px-3 py-1 font-medium ${e.cls}`}>
            {e.label}: {turnos.filter((t) => t.estado === e.id).length}
          </span>
        ))}
      </div>

      <section className={`${card} divide-y divide-brand/10 p-0`}>
        {turnos.length === 0 ? (
          <p className="p-5 text-sm text-brand-dark/70">No hay turnos para este día.</p>
        ) : (
          turnos.map((t) => {
            const est = ESTADOS.find((e) => e.id === t.estado) ?? ESTADOS[1];
            const porRecepcion = t.estado === "atendido" && esRecep;
            const doctorNombre = t.optometrista_id ? (nombreOpt.get(t.optometrista_id) ?? "Otro profesional") : null;
            return (
              <div key={t.id} className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3 ${porRecepcion ? "bg-emerald-50/70" : ""}`}>
                <div className="flex items-center gap-4">
                  <span className="w-12 font-mono text-sm text-brand-dark/60">{t.hora?.slice(0, 5) ?? "—"}</span>
                  <div>
                    <Link href={`/dashboard/pacientes/${t.patient_id}`} className="font-medium text-brand hover:underline">
                      {t.patients?.nombre ?? "Paciente"}
                    </Link>
                    <p className="text-xs text-brand-dark/60">{doctorNombre ?? "Sin optometrista asignado"}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${est.cls}`}>{est.label}</span>
                  {porRecepcion && <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-medium text-white">Pasar por recepción</span>}

                  {/* Recepcion */}
                  {esRecep && t.estado === "agendado" && fecha <= hoy && (
                    <form action={llegoPaciente}>{hidden(t)}<button className={btnGhost}>Llegó</button></form>
                  )}
                  {esRecep && (t.estado === "agendado" || t.estado === "en_espera") && (
                    <form action={cancelarTurno}>
                      {hidden(t)}
                      <ConfirmButton message="¿Cancelar este turno?" className="rounded-lg px-2 py-1.5 text-sm text-red-700 hover:bg-red-50">Cancelar</ConfirmButton>
                    </form>
                  )}
                  {esRecep && (t.estado === "atendido" || t.estado === "finalizado") && (
                    <Link href={`/dashboard/turnos/${t.id}/receta`} className={btnGhost}>Imprimir receta</Link>
                  )}
                  {esRecep && t.estado === "atendido" && (
                    <form action={finalizarTurno}>{hidden(t)}<button className={btnPrimary}>Finalizar</button></form>
                  )}

                  {/* Doctor */}
                  {esDoctor && t.estado === "en_espera" && (
                    <form action={iniciarConsulta}>{hidden(t)}<button className={btnPrimary}>En consultorio</button></form>
                  )}
                  {esDoctor && t.estado === "en_consulta" && (t.optometrista_id === user.id || user.rol === "administrador") && (
                    <Link href={`${volverHref}${volverHref.includes("?") ? "&" : "?"}consulta=${t.id}`} className={btnPrimary}>Continuar consulta</Link>
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>

      {esRecep && proximosDias.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-brand">Próximos turnos agendados</h2>
          <div className="flex flex-wrap gap-2">
            {proximosDias.map(([d, n]) => (
              <Link key={d} href={`/dashboard/turnos?fecha=${d}`} className={btnGhost}>
                <span className="first-letter:uppercase">{formatDateLong(d).split(",")[1]?.trim() ?? d}</span>
                <span className="ml-2 rounded-full bg-iris-light px-2 text-xs font-medium">{n}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
