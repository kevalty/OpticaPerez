import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateLong, isISODate, shiftDate, todayISO } from "@/lib/time";
import { btnGhost, btnPrimary, card } from "@/lib/ui";
import { cambiarEstado } from "./actions";

export const metadata = { title: "Turnos · Óptica Pérez" };

type Turno = {
  id: string;
  hora: string | null;
  estado: "en_espera" | "en_consulta" | "atendido";
  optometrista_id: string | null;
  patient_id: string;
  patients: { nombre: string } | null;
};

const ESTADOS = [
  { id: "en_espera", label: "En espera", cls: "bg-amber-100 text-amber-800" },
  { id: "en_consulta", label: "En consulta", cls: "bg-iris-light text-brand" },
  { id: "atendido", label: "Atendido", cls: "bg-emerald-100 text-emerald-800" },
] as const;

export default async function TurnosPage({ searchParams }: PageProps<"/dashboard/turnos">) {
  const user = await requireRole("recepcionista", "doctor", "administrador");
  const sp = await searchParams;
  const hoy = todayISO();
  const fecha = isISODate(sp.fecha) ? sp.fecha : hoy;
  const puedeCerrar = user.rol === "doctor" || user.rol === "administrador";
  const puedeDarTurno = user.rol === "recepcionista" || user.rol === "administrador";

  const supabase = await createClient();
  const [{ data, error }, { data: opts }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, hora, estado, optometrista_id, patient_id, patients(nombre)")
      .eq("fecha", fecha)
      .is("deleted_at", null)
      .order("hora", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase.rpc("list_optometristas"),
  ]);
  const turnos = (data ?? []) as unknown as Turno[];
  const nombreOpt = new Map(((opts ?? []) as { id: string; nombre: string }[]).map((o) => [o.id, o.nombre]));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-brand">Turnos</h1>
        {puedeDarTurno && (
          <Link href="/dashboard/turnos/nuevo" className={btnPrimary}>
            + Dar turno
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/dashboard/turnos?fecha=${shiftDate(fecha, -1)}`} className={btnGhost} aria-label="Día anterior">←</Link>
        <p className="min-w-56 text-center font-medium capitalize text-brand">{formatDateLong(fecha)}</p>
        <Link href={`/dashboard/turnos?fecha=${shiftDate(fecha, 1)}`} className={btnGhost} aria-label="Día siguiente">→</Link>
        {fecha !== hoy && <Link href="/dashboard/turnos" className={btnGhost}>Hoy</Link>}
      </div>

      {(sp.error || error) && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudo completar la acción. Inténtalo de nuevo.
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
            const est = ESTADOS.find((e) => e.id === t.estado)!;
            return (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="flex items-center gap-4">
                  <span className="w-12 font-mono text-sm text-brand-dark/60">{t.hora?.slice(0, 5) ?? "—"}</span>
                  <div>
                    <Link href={`/dashboard/pacientes/${t.patient_id}`} className="font-medium text-brand hover:underline">
                      {t.patients?.nombre ?? "Paciente"}
                    </Link>
                    <p className="text-xs text-brand-dark/60">
                      {t.optometrista_id ? (nombreOpt.get(t.optometrista_id) ?? "Otro profesional") : "Sin optometrista asignado"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${est.cls}`}>{est.label}</span>
                  {t.estado === "en_espera" && (
                    <form action={cambiarEstado}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="estado" value="en_consulta" />
                      <input type="hidden" name="fecha" value={fecha} />
                      <button className={btnGhost}>Pasar al consultorio</button>
                    </form>
                  )}
                  {t.estado === "en_consulta" && puedeCerrar && (
                    <form action={cambiarEstado}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="estado" value="atendido" />
                      <input type="hidden" name="fecha" value={fecha} />
                      <button className={btnGhost}>Marcar atendido</button>
                    </form>
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>
    </>
  );
}
