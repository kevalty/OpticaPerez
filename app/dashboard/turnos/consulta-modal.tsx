import { ModalShell, CerrarBoton } from "@/components/modal-shell";
import { FichaView } from "@/components/ficha-view";
import { rxComoTexto } from "@/lib/ficha";
import type { FichaCompleta } from "@/lib/fichas-server";
import { formatDateLong } from "@/lib/time";
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
  borradorKey,
}: {
  paciente: PacienteConsulta;
  fichas: FichaCompleta[];
  nombreOpt: Map<string, string>;
  cerrarHref: string;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  borradorKey: string;
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
      <div className="relative mx-auto flex max-h-[calc(100dvh-1.5rem)] max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl sm:max-h-[calc(100dvh-4rem)]">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-brand/10 px-5 py-3 sm:px-7">
          <div>
            <p className="text-xs uppercase tracking-wide text-brand-dark/50">En consultorio</p>
            <h2 className="text-2xl font-semibold text-brand">{paciente.nombre}</h2>
          </div>
          <CerrarBoton className="rounded-lg border border-brand/20 px-3 py-1.5 text-sm text-brand hover:bg-iris-light">
            Cerrar <kbd className="ml-1 rounded bg-iris-light px-1 text-xs">Esc</kbd>
          </CerrarBoton>
        </header>

        <FichaForm
          action={action}
          prefill={prefill}
          rxPrevio={ultima?.rx ?? []}
          borradorKey={borradorKey}
          encabezado={
            <>
        <section aria-label="Datos del paciente" className="flex flex-wrap gap-x-5 gap-y-1 rounded-xl bg-iris-light/40 px-4 py-2 text-sm">
                {datos.filter(([, v]) => v != null && v !== "").map(([k, v]) => (
                  <span key={k}>
                    <span className="text-xs uppercase tracking-wide text-brand-dark/50">{k} </span>
                    <span className="font-medium text-brand-dark">{v}</span>
                  </span>
                ))}
              </section>

              {fichas.length === 0 ? (
                <p className="rounded-xl bg-iris-light px-4 py-2 text-sm text-brand">
                  <strong>Primera consulta:</strong> este paciente no tiene fichas anteriores.
                </p>
              ) : (
                <details className="group rounded-xl border border-brand/15 bg-white">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
                    <span className="font-bold text-brand">📋 Última consulta {ultima.ficha.fecha.split("-").reverse().join("/")}</span>
                    <span className="text-brand-dark/80">
                      OD {rxComoTexto(ultima.rx.find((r) => r.ojo === "OD") ?? { esfera: null, cilindro: null, eje: null }) || "—"} · OI{" "}
                      {rxComoTexto(ultima.rx.find((r) => r.ojo === "OI") ?? { esfera: null, cilindro: null, eje: null }) || "—"}
                    </span>
                    <span className="ml-auto font-semibold text-iris group-open:hidden">Ver ficha completa</span>
                    <span className="ml-auto hidden font-semibold text-iris group-open:inline">Ocultar</span>
                  </summary>
                  <div className="flex flex-col gap-3 border-t border-brand/10 px-4 py-3">
                    <p className="text-sm font-medium first-letter:uppercase text-brand">{cabecera(ultima)}</p>
                    <FichaView ficha={ultima.ficha} rx={ultima.rx} cl={ultima.cl} />
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
                  </div>
                </details>
              )}

            </>
          }
        />
      </div>
    </ModalShell>
  );
}
