import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { MODULES } from "@/lib/roles";
import { card } from "@/lib/ui";

export const metadata = { title: "Panel · Óptica Pérez" };

export default async function DashboardPage() {
  const user = await requireUser();
  if (!user.activo) return null; // el layout ya muestra el aviso de cuenta pendiente
  const modulos = MODULES.filter((m) => m.roles.includes(user.rol));

  return (
    <>
      <h1 className="text-2xl font-semibold text-brand">Bienvenido</h1>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modulos.map((m) => {
          const body = (
            <>
              <h2 className="font-semibold text-brand">{m.titulo}</h2>
              <p className="mt-1 text-sm text-brand-dark/70">{m.detalle}</p>
              {m.href ? (
                <span className="mt-3 inline-block text-sm font-medium text-iris">Abrir →</span>
              ) : (
                <span className="mt-3 inline-block rounded-full bg-iris-light px-2.5 py-0.5 text-xs font-medium text-brand">
                  Disponible en la semana {m.semana}
                </span>
              )}
            </>
          );
          return m.href ? (
            <Link key={m.id} href={m.href} className={`${card} transition hover:ring-iris/50`}>
              {body}
            </Link>
          ) : (
            <div key={m.id} className={card}>
              {body}
            </div>
          );
        })}
      </section>
    </>
  );
}
