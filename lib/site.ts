import { headers } from "next/headers";

// Direccion publica del sistema, para armar el enlace de seguimiento que recibe el cliente.
// En produccion conviene fijar NEXT_PUBLIC_SITE_URL (por ejemplo https://optica-perez.vercel.app o el dominio de la optica).
export async function siteUrl(): Promise<string> {
  const fija = process.env.NEXT_PUBLIC_SITE_URL;
  if (fija) return fija.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "optica-perez.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export const enlaceSeguimiento = (base: string, token: string) => `${base}/seguimiento/${token}`;
