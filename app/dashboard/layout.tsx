import Image from "next/image";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { MODULES, ROLE_LABEL } from "@/lib/roles";
import { logout } from "@/app/login/actions";
import { btnGhost } from "@/lib/ui";

// Todo el panel depende de la sesion y de datos de pacientes: nunca se prerenderiza ni se cachea.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireUser();
  const links = user.activo ? MODULES.filter((m) => m.href && m.roles.includes(user.rol)) : [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/dashboard" aria-label="Inicio">
          <Image src="/logo.png" alt="Óptica Pérez" width={360} height={249} className="h-auto w-24" />
        </Link>
        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="text-sm font-semibold text-brand">{user.nombre || user.email}</p>
            <p className="text-xs text-brand-dark/60">{ROLE_LABEL[user.rol]}</p>
          </div>
          <form action={logout}>
            <button className={btnGhost}>Salir</button>
          </form>
        </div>
      </header>

      {links.length > 0 && (
        <nav className="flex flex-wrap gap-2 border-b border-brand/10 pb-3">
          <Link href="/dashboard" className="rounded-full px-3 py-1 text-sm text-brand hover:bg-iris-light">
            Inicio
          </Link>
          {links.map((m) => (
            <Link key={m.id} href={m.href!} className="rounded-full px-3 py-1 text-sm text-brand hover:bg-iris-light">
              {m.titulo}
            </Link>
          ))}
        </nav>
      )}

      {user.activo ? (
        children
      ) : (
        <section className="rounded-2xl bg-iris-light p-6 text-brand">
          <h1 className="text-lg font-semibold">Tu cuenta está pendiente de activación</h1>
          <p className="mt-1 text-sm">
            Un administrador debe activar tu cuenta y asignarte un rol antes de que puedas usar el sistema.
          </p>
        </section>
      )}
    </div>
  );
}
