"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const schema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(200),
});

const bloqueado = (seg: number) => `Demasiados intentos. Espera ${Math.ceil(seg / 60)} min e inténtalo de nuevo.`;

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!isSupabaseConfigured) {
    return { error: "El sistema aún no está configurado. Contacta al administrador." };
  }

  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Ingresa un correo y una contraseña válidos." };

  const supabase = await createClient();

  // Bloqueo progresivo (migracion 0007). Si la migracion aun no esta aplicada, no se bloquea el acceso.
  const { data: espera } = await supabase.rpc("login_estado", { p_email: parsed.data.email });
  if (typeof espera === "number" && espera > 0) return { error: bloqueado(espera) };

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const { data: nueva } = await supabase.rpc("login_fallo", { p_email: parsed.data.email });
    if (typeof nueva === "number" && nueva > 0) return { error: bloqueado(nueva) };
    // Mensaje generico: no revelar si el correo existe.
    return { error: "Correo o contraseña incorrectos." };
  }
  await supabase.rpc("login_ok", { p_email: parsed.data.email });

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
