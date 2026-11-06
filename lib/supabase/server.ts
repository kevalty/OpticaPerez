import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseKey, supabaseUrl } from "./config";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, { ...options, httpOnly: true }), // el navegador nunca habla con Supabase: el JavaScript de la pagina no necesita leerla
          );
        } catch {
          // Llamado desde un Server Component: el proxy ya refresca la sesion.
        }
      },
    },
  });
}
