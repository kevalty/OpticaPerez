"use server";

import { requireRole } from "@/lib/auth";
import { listarFichas, type FichaFila } from "@/lib/fichas-server";
import { createClient } from "@/lib/supabase/server";
import { cleanSearch } from "@/lib/validation";

// Busqueda de fichas por paciente sin poner nombre ni cedula en la URL. Solo doctor / administrador.
export async function buscarFichas(texto: string): Promise<FichaFila[]> {
  await requireRole("doctor", "administrador");
  return listarFichas(await createClient(), cleanSearch(texto));
}
