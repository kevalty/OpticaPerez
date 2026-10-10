import Link from "next/link";
import { Icono } from "@/components/icons";
import { requireUser } from "@/lib/auth";
import { MODULES } from "@/lib/roles";

export const metadata = { title: "Panel · Óptica Pérez" };

const baldosa =
  "group relative flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-3xl p-4 text-center outline-none transition sm:aspect-square";

// Pantalla de inicio estilo app (movil / tablet): una baldosa grande por modulo, solo icono y nombre.
export default async function DashboardPage() {
  const user = await requireUser();
  if (!user.activo) return null; // el layout ya muestra el aviso de cuenta pendiente
  const modulos = MODULES.filter((m) => m.roles.includes(user.rol));
  const nombre = (user.nombre || user.email).split(" ")[0];

  return (
    <>
      <h1 className="text-2xl font-semibold text-brand">Hola, {nombre}</h1>
      <section aria-label="Módulos" className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
        {modulos.map((m) =>
          m.href ? (
            <Link
              key={m.id}
              href={m.href}
              className={`${baldosa} bg-white shadow-sm ring-1 ring-brand/10 hover:-translate-y-0.5 hover:shadow-md hover:ring-iris/60 focus-visible:ring-2 focus-visible:ring-iris active:scale-[0.97]`}
            >
              <span className="flex size-20 items-center justify-center rounded-2xl bg-iris-light text-brand transition group-hover:bg-brand group-hover:text-white sm:size-24">
                <Icono id={m.id} className="size-11 sm:size-12" />
              </span>
              <span className="text-base font-semibold text-brand sm:text-lg">{m.titulo}</span>
            </Link>
          ) : (
            <div key={m.id} aria-disabled="true" className={`${baldosa} bg-slate-50 text-slate-400 ring-1 ring-slate-200`}>
              <span className="flex size-20 items-center justify-center rounded-2xl bg-slate-100 sm:size-24">
                <Icono id={m.id} className="size-11 sm:size-12" />
              </span>
              <span className="text-base font-semibold sm:text-lg">{m.titulo}</span>
              <span className="absolute right-3 top-3 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">Pronto</span>
            </div>
          ),
        )}
      </section>
    </>
  );
}
