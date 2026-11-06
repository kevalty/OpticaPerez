import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = { title: "Seguimiento de tu pedido · Óptica Pérez", robots: { index: false, follow: false } };

export default function NoEncontrado() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <Image src="/logo.png" alt="Óptica Pérez" width={360} height={249} className="h-auto w-36" />
      <h1 className="text-xl font-semibold text-brand">No encontramos este pedido</h1>
      <p className="text-sm text-brand-dark/70">Revisa que el enlace esté completo. Si el problema continúa, comunícate con nosotros por WhatsApp o pasa por el local.</p>
    </main>
  );
}
