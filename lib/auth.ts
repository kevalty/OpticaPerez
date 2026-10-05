import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Role } from "@/lib/roles";

export type CurrentUser = {
  id: string;
  email: string;
  nombre: string;
  rol: Role;
  activo: boolean;
};

// Devuelve el usuario autenticado y su perfil. Redirige a /login si no hay sesion valida.
export const requireUser = cache(async (): Promise<CurrentUser> => {
  if (!isSupabaseConfigured) redirect("/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("users")
    .select("id, email, nombre, rol, activo")
    .eq("id", user.id)
    .maybeSingle();

  // Sin perfil o inactivo: sin permisos (RLS tampoco le dejara ver nada).
  return {
    id: user.id,
    email: perfil?.email ?? user.email ?? "",
    nombre: perfil?.nombre ?? "",
    rol: (perfil?.rol as Role) ?? "otro",
    activo: perfil?.activo ?? false,
  };
});

// Exige sesion activa y uno de los roles indicados; si no, vuelve al panel.
// Es una barrera de UX: la proteccion real son las politicas RLS en la base de datos.
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.activo || !roles.includes(user.rol)) redirect("/dashboard");
  return user;
}
