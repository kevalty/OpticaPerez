import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClRow, Ficha, RxRow } from "@/lib/ficha";

export type FichaCompleta = { ficha: Ficha; rx: RxRow[]; cl: ClRow[] };

// Carga las ultimas fichas de un paciente (la RLS solo deja pasar a doctor/administrador)
// y deja constancia en la bitacora de auditoria de cada ficha que se muestra.
export async function cargarFichas(supabase: SupabaseClient, patientId: string, limite = 5): Promise<FichaCompleta[]> {
  const { data: fichas } = await supabase
    .from("medical_records")
    .select("*")
    .eq("patient_id", patientId)
    .is("deleted_at", null)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limite);
  const lista = (fichas ?? []) as Ficha[];
  if (lista.length === 0) return [];

  const ids = lista.map((f) => f.id);
  const [{ data: rx }, { data: cl }] = await Promise.all([
    supabase
      .from("rx_prescriptions")
      .select("record_id, ojo, esfera, cilindro, eje, av, add, dp, color, bifocal")
      .in("record_id", ids)
      .is("deleted_at", null),
    supabase.from("contact_lens_trials").select("record_id, ojo, prueba, av").in("record_id", ids).is("deleted_at", null),
  ]);
  await Promise.all(ids.map((id) => supabase.rpc("log_access", { p_tabla: "medical_records", p_registro_id: id, p_accion: "ver" })));

  const rxAll = (rx ?? []) as (RxRow & { record_id: string })[];
  const clAll = (cl ?? []) as (ClRow & { record_id: string })[];
  return lista.map((ficha) => ({
    ficha,
    rx: rxAll.filter((r) => r.record_id === ficha.id).sort((a, b) => a.ojo.localeCompare(b.ojo) * -1),
    cl: clAll.filter((r) => r.record_id === ficha.id).sort((a, b) => a.ojo.localeCompare(b.ojo) * -1),
  }));
}

export type FichaFila = { id: string; fecha: string; paciente: string; documento: string | null; doctor: string };
export const LIMITE_FICHAS = 50;

// Lista de fichas (mas recientes primero), con busqueda opcional por nombre o documento del paciente.
// La RLS solo deja pasar a doctor/administrador. No incluye contenido clinico: solo quien, cuando y de quien.
export async function listarFichas(supabase: SupabaseClient, q: string): Promise<FichaFila[]> {
  let query = supabase
    .from("medical_records")
    .select("id, fecha, optometrista_id, patients!inner(nombre, documento)")
    .is("deleted_at", null)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(LIMITE_FICHAS);
  if (q) query = query.or(`nombre.ilike.%${q}%,documento.ilike.%${q}%`, { referencedTable: "patients" });
  const [{ data, error }, { data: opts }] = await Promise.all([query, supabase.rpc("list_optometristas")]);
  if (error) console.error("listarFichas fallo:", error.code);
  const doctores = new Map(((opts ?? []) as { id: string; nombre: string }[]).map((o) => [o.id, o.nombre]));
  type Fila = { id: string; fecha: string; optometrista_id: string; patients: { nombre: string; documento: string | null } | null };
  return ((data ?? []) as unknown as Fila[]).map((f) => ({
    id: f.id,
    fecha: f.fecha,
    paciente: f.patients?.nombre ?? "Paciente",
    documento: f.patients?.documento ?? null,
    doctor: doctores.get(f.optometrista_id) ?? "Otro profesional",
  }));
}

// Una ficha completa con su Rx y lentes de contacto. Deja constancia en la bitacora de auditoria.
export async function cargarFichaPorId(supabase: SupabaseClient, id: string): Promise<(FichaCompleta & { patientId: string }) | null> {
  const { data: ficha } = await supabase.from("medical_records").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!ficha) return null;
  const [{ data: rx }, { data: cl }] = await Promise.all([
    supabase
      .from("rx_prescriptions")
      .select("ojo, esfera, cilindro, eje, av, add, dp, color, bifocal")
      .eq("record_id", id)
      .is("deleted_at", null),
    supabase.from("contact_lens_trials").select("ojo, prueba, av").eq("record_id", id).is("deleted_at", null),
  ]);
  await supabase.rpc("log_access", { p_tabla: "medical_records", p_registro_id: id, p_accion: "ver" });
  const orden = <T extends { ojo: string }>(a: T[]) => a.sort((x, y) => x.ojo.localeCompare(y.ojo) * -1);
  return {
    ficha: ficha as Ficha,
    rx: orden((rx ?? []) as RxRow[]),
    cl: orden((cl ?? []) as ClRow[]),
    patientId: (ficha as { patient_id: string }).patient_id,
  };
}
