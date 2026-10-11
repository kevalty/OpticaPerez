import Link from "next/link";
import { BuscadorPacientes } from "@/components/buscador-pacientes";
import { TurnoFields } from "@/components/turno-fields";
import { requireRole } from "@/lib/auth";
import { mensajeSeguro } from "@/lib/mensajes";
import { LIMITE_PACIENTES, type PacienteFila } from "@/lib/pacientes";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/time";
import { btnPrimary, card } from "@/lib/ui";
import { uuid } from "@/lib/validation";
import { darTurno } from "../actions";

export const metadata = { title: "Dar turno · Óptica Pérez" };

export default async function NuevoTurnoPage({ searchParams }: PageProps<"/dashboard/turnos/nuevo">) {
  await requireRole("recepcionista", "administrador");
  const sp = await searchParams;
  const elegido = typeof sp.paciente === "string" && uuid.safeParse(sp.paciente).success ? sp.paciente : null;
  const error = mensajeSeguro(sp.error);

  const supabase = await createClient();
  const [{ data: opts }, { data: lista }, { data: elegidoData }] = await Promise.all([
    supabase.rpc("list_optometristas"),
    supabase
      .from("patients")
      .select("id, nombre, documento, telefono, edad")
      .is("deleted_at", null)
      .order("nombre")
      .limit(LIMITE_PACIENTES),
    elegido
      ? supabase.from("patients").select("id, nombre").eq("id", elegido).is("deleted_at", null).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const optometristas = (opts ?? []) as { id: string; nombre: string }[];
  const paciente = elegidoData as { id: string; nombre: string } | null;

  return (
    <>
      <div>
        <Link href="/dashboard/turnos" className="text-sm text-iris hover:underline">← Turnos</Link>
        <h1 className="text-2xl font-semibold text-brand">Dar turno</h1>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <BuscadorPacientes
        inicial={(lista ?? []) as PacienteFila[]}
        hrefBase="/dashboard/turnos/nuevo?paciente="
        seleccionadoId={paciente?.id}
        autoFocus={!paciente}
      />

      {paciente && (
        <form action={darTurno} className={`${card} flex max-w-xl flex-col gap-4`}>
          <input type="hidden" name="patient_id" value={paciente.id} />
          <h2 className="font-semibold text-brand">Turno para {paciente.nombre}</h2>
          <TurnoFields hoy={todayISO()} optometristas={optometristas} />
          <div><button className={btnPrimary}>Dar turno</button></div>
        </form>
      )}

      <p className="text-sm text-brand-dark/70">
        ¿Es un paciente nuevo?{" "}
        <Link href="/dashboard/pacientes/nuevo" className="font-medium text-iris hover:underline">Regístralo y dale turno</Link>
      </p>
    </>
  );
}
