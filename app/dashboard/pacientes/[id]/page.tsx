import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateLong } from "@/lib/time";
import { uuid } from "@/lib/validation";
import { btnGhost, btnPrimary, card, inputCls } from "@/lib/ui";
import { darTurno } from "../../turnos/actions";
import { archivePatient } from "../actions";

export const metadata = { title: "Paciente · Óptica Pérez" };

const ESTADO: Record<string, string> = { en_espera: "En espera", en_consulta: "En consulta", atendido: "Atendido" };

export default async function PacientePage({ params, searchParams }: PageProps<"/dashboard/pacientes/[id]">) {
  const user = await requireRole("recepcionista", "doctor", "administrador");
  const { id } = await params;
  const { error: errorParam } = await searchParams;
  if (!uuid.safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: p } = await supabase
    .from("patients")
    .select("id, nombre, direccion, telefono, edad, ocupacion, fecha_registro")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!p) notFound();

  const puedeDarTurno = user.rol === "recepcionista" || user.rol === "administrador";
  const [{ data: turnos }, { data: opts }] = await Promise.all([
    supabase.from("appointments").select("id, fecha, estado").eq("patient_id", id).is("deleted_at", null).order("fecha", { ascending: false }).limit(10),
    puedeDarTurno ? supabase.rpc("list_optometristas") : Promise.resolve({ data: [] }),
  ]);
  const historial = (turnos ?? []) as { id: string; fecha: string; estado: string }[];
  const optometristas = (opts ?? []) as { id: string; nombre: string }[];

  const datos: [string, string | number | null][] = [
    ["Teléfono", p.telefono],
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

      {errorParam && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo completar la acción. Inténtalo de nuevo.</p>}

      <section className={card}>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {datos.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs uppercase tracking-wide text-brand-dark/50">{k}</dt>
              <dd className="text-brand-dark">{v ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </section>

      {puedeDarTurno && (
        <section className={card}>
          <h2 className="mb-3 font-semibold text-brand">Dar turno hoy</h2>
          <form action={darTurno} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="patient_id" value={id} />
            <label className="flex min-w-48 flex-col gap-1 text-sm text-brand">
              Optometrista
              <select name="optometrista_id" defaultValue="" className={inputCls}>
                <option value="">Cualquiera disponible</option>
                {optometristas.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
            </label>
            <button className={btnPrimary}>Dar turno</button>
          </form>
        </section>
      )}

      {(user.rol === "doctor" || user.rol === "administrador") && (
        <section className={card}>
          <h2 className="font-semibold text-brand">Fichas médicas</h2>
          <p className="mt-1 text-sm text-brand-dark/70">El historial clínico de este paciente estará disponible en la semana 3.</p>
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
                <span className="capitalize text-brand-dark">{formatDateLong(t.fecha)}</span>
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
