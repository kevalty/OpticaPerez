import Link from "next/link";
import { TurnoFields } from "@/components/turno-fields";
import { requireRole } from "@/lib/auth";
import { mensajeSeguro } from "@/lib/mensajes";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/time";
import { btnGhost, btnPrimary, card, inputCls } from "@/lib/ui";
import { cleanSearch, uuid } from "@/lib/validation";
import { darTurno } from "../actions";

export const metadata = { title: "Dar turno · Óptica Pérez" };

type Paciente = { id: string; nombre: string; documento: string | null; telefono: string | null };

export default async function NuevoTurnoPage({ searchParams }: PageProps<"/dashboard/turnos/nuevo">) {
  await requireRole("recepcionista", "administrador");
  const sp = await searchParams;
  const q = cleanSearch(sp.q);
  const elegido = typeof sp.paciente === "string" && uuid.safeParse(sp.paciente).success ? sp.paciente : null;
  const error = mensajeSeguro(sp.error);

  const supabase = await createClient();
  const { data: opts } = await supabase.rpc("list_optometristas");
  const optometristas = (opts ?? []) as { id: string; nombre: string }[];

  let pacientes: Paciente[] = [];
  if (q) {
    const { data } = await supabase
      .from("patients")
      .select("id, nombre, documento, telefono")
      .is("deleted_at", null)
      .or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%,documento.ilike.%${q}%`)
      .order("nombre")
      .limit(10);
    pacientes = (data ?? []) as Paciente[];
  }

  let paciente: Paciente | null = null;
  if (elegido) {
    const { data } = await supabase
      .from("patients")
      .select("id, nombre, documento, telefono")
      .eq("id", elegido)
      .is("deleted_at", null)
      .maybeSingle();
    paciente = (data as Paciente | null) ?? null;
  }

  return (
    <>
      <div>
        <Link href="/dashboard/turnos" className="text-sm text-iris hover:underline">← Turnos</Link>
        <h1 className="text-2xl font-semibold text-brand">Dar turno</h1>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form action="/dashboard/turnos/nuevo" className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar paciente por nombre, cédula o celular" maxLength={60} autoFocus={!paciente} className={inputCls} />
        <button className={btnGhost}>Buscar</button>
      </form>

      {q && (
        <section className={`${card} divide-y divide-brand/10 p-0`}>
          {pacientes.length === 0 ? (
            <p className="p-5 text-sm text-brand-dark/70">No se encontró ningún paciente.</p>
          ) : (
            pacientes.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/turnos/nuevo?q=${encodeURIComponent(q)}&paciente=${p.id}`}
                className={`flex items-center justify-between gap-3 px-5 py-3 hover:bg-iris-light/50 ${p.id === paciente?.id ? "bg-iris-light/60" : ""}`}
              >
                <span className="font-medium text-brand">{p.nombre}</span>
                <span className="text-xs text-brand-dark/60">{[p.documento, p.telefono].filter(Boolean).join(" · ")}</span>
              </Link>
            ))
          )}
        </section>
      )}

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
