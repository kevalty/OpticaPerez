import Image from "next/image";
import Link from "next/link";
import { btnPrimary } from "@/lib/ui";

export const metadata = { title: "Página no encontrada · Óptica Pérez" };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
      <Image src="/logo.png" alt="Óptica Pérez" width={360} height={249} className="h-auto w-40" />
      <h1 className="text-2xl font-semibold text-brand">No encontramos esa página</h1>
      <p className="text-sm text-brand-dark/70">Puede que el enlace esté mal escrito o que el registro ya no exista.</p>
      <Link href="/dashboard" className={btnPrimary}>
        Volver al inicio
      </Link>
    </main>
  );
}
