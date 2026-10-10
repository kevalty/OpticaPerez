import { ModalShell, CerrarBoton } from "@/components/modal-shell";
import { FichaView } from "@/components/ficha-view";
import { rxComoTexto } from "@/lib/ficha";
import type { FichaCompleta } from "@/lib/fichas-server";
import { formatDateLong } from "@/lib/time";
import { card } from "@/lib/ui";
import type { FormState } from "@/lib/validation";
import { FichaForm } from "./ficha-form";

export type PacienteConsulta = {
  id: string;
  nombre: string;
  tipo_documento: string;
  documento: string | null;
  telefono: string | null;
  email: string | null;
  edad: number | null;
  ocupacion: string | null;
  direccion: string | null;
};

// Pop-up de la consulta: datos del paciente, fichas anteriores y ficha nueva a llenar.
export function ConsultaModal({
  paciente,
  fichas,
  nombreOpt,
  cerrarHref,
  action,
}: {
  paciente: PacienteConsulta;
  fichas: FichaCompleta[];
  nombreOpt: Map<string, string>;
  cerrarHref: string;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [ultima, ...anteriores] = fichas;
  const prefill = {
    rx_anterior_od: ultima ? rxComoTexto(ultima.rx.find((r) => r.ojo === "OD") ?? { esfera: null, cilindro: null, eje: null }) : "",
    rx_anterior_oi: ultima ? rxComoTexto(ultima.rx.find((r) => r.ojo === "OI") ?? { esfera: null, cilindro: null, eje: null }) : "",
  };

  const datos: [string, string | number | null][] = [
    [paciente.tipo_documento === "pasaporte" ? "Pasaporte" : "Cédula", paciente.documento],
    ["Celular", paciente.telefono],
    ["Correo", paciente.email],
    ["Edad", paciente.edad != null ? `${paciente.edad} años` : null],
    ["Ocupación", paciente.ocupacion],
    ["Dirección", paciente.direccion],
  ];

  const cabecera = (f: FichaCompleta) =>
    `${formatDateLong(f.ficha.fecha)} · ${nombreOpt.get(f.ficha.optometrista_id) ?? "Otro profesional"}`;

  return (
    <ModalShell cerrarHref={cerrarHref} titulo={`Consulta de ${paciente.nombre}`}>
      <div className="mx-auto flex max-w-4xl flex-col gap-5 rounded-2xl bg-white p-5 shadow-xl sm:p-7">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-brand-dark/50">En consultorio</p>
            <h2 className="text-2xl font-semibold text-brand">{paciente.nombre}</h2>
          </div>
          <CerrarBoton className="rounded-lg border border-brand/20 px-3 py-1.5 text-sm text-brand hover:bg-iris-light">
            Cerrar <kbd className="ml-1 rounded bg-iris-light px-1 text-xs">Esc</kbd>
          </CerrarBoton>
        </header>

        <section className={card}>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
            {datos.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs uppercase tracking-wide text-brand-dark/50">{k}</dt>
                <dd className="text-brand-dark">{v ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </section>

        {fichas.length === 0 ? (
          <p className="rounded-xl bg-iris-light px-4 py-3 text-sm text-brand">
            <strong>Primera consulta:</strong> este paciente no tiene fichas anteriores. Llena la ficha de abajo.
          </p>
        ) : (
          <section className="flex flex-col gap-2">
            <h3 className="font-semibold text-brand">Ficha anterior</h3>
            <div className={card}>
              <p className="mb-3 text-sm font-medium first-letter:uppercase text-brand">{cabecera(ultima)}</p>
              <FichaView ficha={ultima.ficha} rx={ultima.rx} cl={ultima.cl} />
            </div>
            {anteriores.length > 0 && (
              <details className="rounded-xl ring-1 ring-brand/10">
                <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-brand">
                  Ver {anteriores.length} ficha{anteriores.length > 1 ? "s" : ""} más antigua{anteriores.length > 1 ? "s" : ""}
                </summary>
                <div className="flex flex-col gap-4 px-4 pb-4">
                  {anteriores.map((f) => (
                    <div key={f.ficha.id} className="border-t border-brand/10 pt-3">
                      <p className="mb-2 text-sm font-medium first-letter:uppercase text-brand">{cabecera(f)}</p>
                      <FichaView ficha={f.ficha} rx={f.rx} cl={f.cl} />
                    </div>
                  ))}
                </div>
              </details>
            )}
          </section>
        )}

        <section className="flex flex-col gap-3 border-t border-brand/10 pt-5">
          <h3 className="text-lg font-semibold text-brand">Ficha de hoy</h3>
          <FichaForm action={action} prefill={prefill} />
        </section>
      </div>
    </ModalShell>
  );
}
