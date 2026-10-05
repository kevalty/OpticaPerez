import Image from "next/image";
import { LoginForm } from "./login-form";

export const metadata = { title: "Ingresar · Óptica Pérez" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-brand/10">
        <Image src="/logo.png" alt="Óptica Pérez" width={360} height={249} priority className="h-auto w-48" />
        <h1 className="text-xl font-semibold text-brand">Ingresar al sistema</h1>
        <LoginForm />
      </div>
    </main>
  );
}
