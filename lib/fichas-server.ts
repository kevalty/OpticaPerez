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
