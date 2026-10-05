import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cleanSearch } from "@/lib/validation";
import { btnGhost, btnPrimary, card, inputCls } from "@/lib/ui";
import { darTurno } from "../actions";

export const metadata = { title: "Dar turno · Óptica Pérez" };

export default async function NuevoTurnoPage({ searchParams }: PageProps<"/dashboard/turnos/nuevo">) {
  await requireRole("recepcionista", "administrador");
  const sp = await searchParams;
  const q = cleanSearch(sp.q);

  const supabase = await createClient();
  const { data: opts } = await supabase.rpc("list_optometristas");
  const optometristas = (opts ?? []) as { id: string; nombre: string }[];

  let pacientes: { id: string; nombre: string; telefono: string | null }[] = [];
  if (q) {
    const { data } = await supabase
      .from("patients")
      .select("id, nombre, telefono")
      .is("deleted_at", null)
      .or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%`)
      .order("nombre")
      .limit(10);
    pacientes = (data ?? []) as typeof pacientes;
  }

  return (
    <>
      <div>
        <Link href="/dashboard/turnos" className="text-sm text-iris hover:underline">← Turnos</Link>
        <h1 className="text-2xl font-semibold text-brand">Dar turno</h1>
      </div>

      {sp.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo dar el turno. Inténtalo de nuevo.</p>}

      <form action="/dashboard/turnos/nuevo" className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar paciente por nombre o teléfono" maxLength={60} autoFocus className={inputCls} />
        <button className={btnGhost}>Buscar</button>
      </form>

      {q && (
        <section className={`${card} divide-y divide-brand/10 p-0`}>
          {pacientes.length === 0 ? (
            <p className="p-5 text-sm text-brand-dark/70">No se encontró ningún paciente.</p>
          ) : (
            pacientes.map((p) => (
              <form key={p.id} action={darTurno} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <input type="hidden" name="patient_id" value={p.id} />
                <div>
                  <p className="font-medium text-brand">{p.nombre}</p>
                  <p className="text-xs text-brand-dark/60">{p.telefono ?? "Sin teléfono"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select name="optometrista_id" defaultValue="" aria-label="Optometrista" className={`${inputCls} w-auto`}>
                    <option value="">Cualquiera disponible</option>
                    {optometristas.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                  </select>
                  <button className={btnPrimary}>Dar turno</button>
                </div>
              </form>
            ))
          )}
        </section>
      )}

      <p className="text-sm text-brand-dark/70">
        ¿Es un paciente nuevo?{" "}
        <Link href="/dashboard/pacientes/nuevo" className="font-medium text-iris hover:underline">Regístralo y dale turno</Link>
      </p>
    </>
  );
}
