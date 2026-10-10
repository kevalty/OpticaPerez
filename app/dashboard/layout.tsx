import Image from "next/image";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { MODULES, ROLE_LABEL } from "@/lib/roles";
import { logout } from "@/app/login/actions";
import { btnGhost } from "@/lib/ui";
import { Atajos } from "@/components/atajos";
import { NavLinks } from "@/components/nav-links";

// Todo el panel depende de la sesion y de datos de pacientes: nunca se prerenderiza ni se cachea.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireUser();
  const links = user.activo ? MODULES.filter((m) => m.href && m.roles.includes(user.rol)) : [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 pb-28 sm:px-6 sm:pb-6 print:max-w-none print:p-0">
      <header className="flex flex-wrap items-center justify-between gap-4 print:hidden">
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

      {links.length > 0 && <NavLinks items={links.map((m) => ({ id: m.id, titulo: m.titulo, href: m.href! }))} />}
      <Atajos />

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
