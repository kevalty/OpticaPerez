import Image from "next/image";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <Image
        src="/logo.png"
        alt="Óptica Pérez, en tus ojos desde 1977"
        width={360}
        height={249}
        priority
        className="h-auto w-72 sm:w-96"
      />
      <h1 className="text-2xl font-semibold text-brand sm:text-3xl">
        Sistema de gestión
      </h1>
      <p className="max-w-md text-brand-dark/70">
        Estamos preparando la plataforma. Pronto podrás gestionar pacientes,
        turnos, pedidos e inventario desde aquí.
      </p>
      <span className="rounded-full bg-iris-light px-4 py-1 text-sm font-medium text-brand">
        En construcción
      </span>
    </main>
  );
}
