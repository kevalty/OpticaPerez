import Image from "next/image";
import { requireUser } from "@/lib/auth";
import { MODULES, ROLE_LABEL } from "@/lib/roles";
import { logout } from "@/app/login/actions";

export const metadata = { title: "Panel · Óptica Pérez" };

export default async function DashboardPage() {
  const user = await requireUser();
  const modulos = user.activo ? MODULES.filter((m) => m.roles.includes(user.rol)) : [];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-8">
      <header className="flex items-center justify-between gap-4">
        <Image src="/logo.png" alt="Óptica Pérez" width={360} height={249} className="h-auto w-24" />
        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="text-sm font-semibold text-brand">{user.nombre || user.email}</p>
            <p className="text-xs text-brand-dark/60">{ROLE_LABEL[user.rol]}</p>
          </div>
          <form action={logout}>
            <button className="rounded-lg border border-brand/20 px-3 py-1.5 text-sm text-brand hover:bg-iris-light">
              Salir
            </button>
          </form>
        </div>
      </header>

      {!user.activo ? (
        <section className="rounded-2xl bg-iris-light p-6 text-brand">
          <h1 className="text-lg font-semibold">Tu cuenta está pendiente de activación</h1>
          <p className="mt-1 text-sm">
            Un administrador debe activar tu cuenta y asignarte un rol antes de que puedas usar el sistema.
          </p>
        </section>
      ) : (
        <>
          <h1 className="text-2xl font-semibold text-brand">Bienvenido</h1>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modulos.map((m) => (
              <div key={m.id} className="rounded-2xl bg-white p-5 ring-1 ring-brand/10">
                <h2 className="font-semibold text-brand">{m.titulo}</h2>
                <p className="mt-1 text-sm text-brand-dark/70">{m.detalle}</p>
                <span className="mt-3 inline-block rounded-full bg-iris-light px-2.5 py-0.5 text-xs font-medium text-brand">
                  Disponible en la semana {m.semana}
                </span>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
