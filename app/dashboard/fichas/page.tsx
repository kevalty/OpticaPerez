import { BuscadorFichas } from "@/components/buscador-fichas";
import { requireRole } from "@/lib/auth";
import { listarFichas } from "@/lib/fichas-server";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Fichas médicas · Óptica Pérez" };

// Solo doctor y administrador (la RLS tambien lo exige: la recepcionista no lee fichas).
export default async function FichasPage() {
  await requireRole("doctor", "administrador");
  const fichas = await listarFichas(await createClient(), "");
  return (
    <>
      <h1 className="text-2xl font-semibold text-brand">Fichas médicas</h1>
      <BuscadorFichas inicial={fichas} />
    </>
  );
}
