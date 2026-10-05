import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cleanSearch } from "@/lib/validation";
import { btnGhost, btnPrimary, card, inputCls } from "@/lib/ui";

export const metadata = { title: "Pacientes · Óptica Pérez" };

const LIMITE = 50;

export default async function PacientesPage({ searchParams }: PageProps<"/dashboard/pacientes">) {
  await requireRole("recepcionista", "doctor", "administrador");
  const q = cleanSearch((await searchParams).q);

  const supabase = await createClient();
  let query = supabase
    .from("patients")
    .select("id, nombre, telefono, edad, fecha_registro")
    .is("deleted_at", null)
    .order("nombre", { ascending: true })
    .limit(LIMITE);
  if (q) query = query.or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%`);

  const { data, error } = await query;
  const pacientes = (data ?? []) as { id: string; nombre: string; telefono: string | null; edad: number | null; fecha_registro: string }[];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-brand">Pacientes</h1>
        <Link href="/dashboard/pacientes/nuevo" className={btnPrimary}>
          + Nuevo paciente
        </Link>
      </div>

      <form className="flex gap-2" action="/dashboard/pacientes">
        <input name="q" defaultValue={q} placeholder="Buscar por nombre o teléfono" maxLength={60} className={inputCls} />
        <button className={btnGhost}>Buscar</button>
      </form>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo cargar la lista de pacientes.</p>}

      <section className={`${card} divide-y divide-brand/10 p-0`}>
        {pacientes.length === 0 ? (
          <p className="p-5 text-sm text-brand-dark/70">{q ? "No hay pacientes que coincidan con la búsqueda." : "Aún no hay pacientes registrados."}</p>
        ) : (
          pacientes.map((p) => (
            <Link key={p.id} href={`/dashboard/pacientes/${p.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-iris-light/50">
              <span className="font-medium text-brand">{p.nombre}</span>
              <span className="text-sm text-brand-dark/60">
                {[p.edad != null ? `${p.edad} años` : null, p.telefono].filter(Boolean).join(" · ")}
              </span>
            </Link>
          ))
        )}
      </section>
      {pacientes.length === LIMITE && <p className="text-xs text-brand-dark/60">Se muestran los primeros {LIMITE}. Afina la búsqueda para ver otros.</p>}
    </>
  );
}
