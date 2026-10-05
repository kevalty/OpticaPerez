import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { FichaView } from "@/components/ficha-view";
import { TurnoFields } from "@/components/turno-fields";
import { requireRole } from "@/lib/auth";
import { cargarFichas } from "@/lib/fichas-server";
import { mensajeSeguro } from "@/lib/mensajes";
import { createClient } from "@/lib/supabase/server";
import { formatDateLong, todayISO } from "@/lib/time";
import { uuid } from "@/lib/validation";
import { btnGhost, btnPrimary, card } from "@/lib/ui";
import { darTurno } from "../../turnos/actions";
import { archivePatient } from "../actions";

export const metadata = { title: "Paciente · Óptica Pérez" };

const ESTADO: Record<string, string> = {
  agendado: "Agendado",
  en_espera: "En espera",
  en_consulta: "En consulta",
  atendido: "Atendido",
  finalizado: "Finalizado",
};

export default async function PacientePage({ params, searchParams }: PageProps<"/dashboard/pacientes/[id]">) {
  const user = await requireRole("recepcionista", "doctor", "administrador");
  const { id } = await params;
  const error = mensajeSeguro((await searchParams).error);
  if (!uuid.safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: p } = await supabase
    .from("patients")
    .select("id, nombre, tipo_documento, documento, direccion, telefono, edad, ocupacion, fecha_registro")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!p) notFound();

  const puedeDarTurno = user.rol === "recepcionista" || user.rol === "administrador";
  const veFichas = user.rol === "doctor" || user.rol === "administrador";
  const [{ data: turnos }, { data: opts }, fichas] = await Promise.all([
    supabase.from("appointments").select("id, fecha, estado").eq("patient_id", id).is("deleted_at", null).order("fecha", { ascending: false }).limit(10),
    supabase.rpc("list_optometristas"),
    veFichas ? cargarFichas(supabase, id, 10) : Promise.resolve([]),
  ]);
  const historial = (turnos ?? []) as { id: string; fecha: string; estado: string }[];
  const optometristas = (opts ?? []) as { id: string; nombre: string }[];
  const nombreOpt = new Map(optometristas.map((o) => [o.id, o.nombre]));

  const datos: [string, string | number | null][] = [
    [p.tipo_documento === "pasaporte" ? "Pasaporte" : "Cédula", p.documento],
    ["Celular", p.telefono],
    ["Edad", p.edad != null ? `${p.edad} años` : null],
    ["Ocupación", p.ocupacion],
    ["Dirección", p.direccion],
    ["Registrado", formatDateLong(p.fecha_registro)],
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/pacientes" className="text-sm text-iris hover:underline">← Pacientes</Link>
          <h1 className="text-2xl font-semibold text-brand">{p.nombre}</h1>
        </div>
        <Link href={`/dashboard/pacientes/${id}/editar`} className={btnGhost}>Editar datos</Link>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className={card}>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {datos.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs uppercase tracking-wide text-brand-dark/50">{k}</dt>
              <dd className="text-brand-dark">{v ?? "—"}</dd>
            </div>
          ))}
        </dl>
        {!p.documento && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Falta el número de documento de este paciente. Complétalo en “Editar datos”.
          </p>
        )}
      </section>

      {puedeDarTurno && (
        <section className={card}>
          <h2 className="mb-3 font-semibold text-brand">Dar turno</h2>
          <form action={darTurno} className="flex max-w-xl flex-col gap-4">
            <input type="hidden" name="patient_id" value={id} />
            <TurnoFields hoy={todayISO()} optometristas={optometristas} />
            <div><button className={btnPrimary}>Dar turno</button></div>
          </form>
        </section>
      )}

      {veFichas && (
        <section className={`${card} flex flex-col gap-3`}>
          <h2 className="font-semibold text-brand">Fichas médicas</h2>
          {fichas.length === 0 ? (
            <p className="text-sm text-brand-dark/70">Este paciente aún no tiene fichas. Se crean durante la consulta, desde Turnos.</p>
          ) : (
            fichas.map((f, i) => (
              <details key={f.ficha.id} open={i === 0} className="rounded-xl ring-1 ring-brand/10">
                <summary className="cursor-pointer px-4 py-2 text-sm font-medium first-letter:uppercase text-brand">
                  {formatDateLong(f.ficha.fecha)} · {nombreOpt.get(f.ficha.optometrista_id) ?? "Otro profesional"}
                </summary>
                <div className="px-4 pb-4">
                  <FichaView ficha={f.ficha} rx={f.rx} cl={f.cl} />
                </div>
              </details>
            ))
          )}
        </section>
      )}

      <section className={card}>
        <h2 className="mb-3 font-semibold text-brand">Últimos turnos</h2>
        {historial.length === 0 ? (
          <p className="text-sm text-brand-dark/70">Este paciente aún no tiene turnos.</p>
        ) : (
          <ul className="divide-y divide-brand/10 text-sm">
            {historial.map((t) => (
              <li key={t.id} className="flex justify-between py-2">
                <span className="first-letter:uppercase text-brand-dark">{formatDateLong(t.fecha)}</span>
                <span className="text-brand-dark/60">{ESTADO[t.estado] ?? t.estado}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {user.rol === "administrador" && (
        <form action={archivePatient} className="pt-2">
          <input type="hidden" name="id" value={id} />
          <ConfirmButton message="¿Archivar a este paciente? Dejará de aparecer en las listas (no se borra)." className="text-sm text-red-700 hover:underline">
            Archivar paciente
          </ConfirmButton>
        </form>
      )}
    </>
  );
}
