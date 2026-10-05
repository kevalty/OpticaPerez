import Image from "next/image";
import { controlCada, dpTotal, fechaCertificado, fmtDp } from "@/lib/certificado";
import { formatRx } from "@/lib/ficha";
import { NEGOCIO } from "@/lib/negocio";

export type CertificadoDatos = {
  paciente: string;
  fecha: string;
  optometrista: string | null;
  registro_msp: string | null;
  avh_condicion: string | null;
  avh_od: string | null;
  avh_oi: string | null;
  rx_tipo: string | null;
  cie_od: string | null;
  cie_oi: string | null;
  test_colores: string | null;
  necesita_lentes: boolean | null;
  control_meses: number | null;
  indicaciones: string | null;
  rx: { ojo: string; esfera: number | null; cilindro: number | null; eje: number | null; av: string | null; add: number | null; dp: number | null }[];
};

const tiene = (v: unknown) => v != null && v !== "";

// Documento imprimible con el formato de la hoja de Optica Perez. Lo que esta vacio no se imprime.
export function CertificadoDoc({ c }: { c: CertificadoDatos }) {
  const rxConDatos = c.rx.filter((r) => [r.esfera, r.cilindro, r.eje, r.add, r.av].some(tiene));
  const mostrarAdd = c.rx.some((r) => tiene(r.add));
  const dp = dpTotal(c.rx);
  const hayAvh = tiene(c.avh_condicion) || tiene(c.avh_od) || tiene(c.avh_oi);
  const hayCie = tiene(c.cie_od) || tiene(c.cie_oi);

  return (
    <article className="relative mx-auto flex min-h-[273mm] print:min-h-[255mm] print:break-inside-avoid w-full max-w-[210mm] flex-col overflow-hidden bg-white px-10 py-8 text-[13px] uppercase leading-relaxed text-brand-dark ring-1 ring-brand/10 print:max-w-none print:px-2 print:py-0 print:ring-0">
        {/* Marca de agua */}
        <Image
          src="/logo-icon.png"
          alt=""
          width={442}
          height={384}
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[44%] h-auto w-80 -translate-x-1/2 -translate-y-1/2 opacity-[0.07] select-none"
        />

        {/* Encabezado */}
        <header className="relative flex items-center gap-5 border-b-2 border-brand pb-3">
          <Image src="/logo-icon.png" alt="Óptica Pérez" width={442} height={384} className="h-auto w-24 shrink-0" />
          <div className="flex-1 text-center text-brand">
            <p className="text-4xl font-extrabold tracking-wide">{NEGOCIO.nombre}</p>
            {NEGOCIO.lineas.map((l) => (
              <p key={l} className="text-[11px] leading-tight">{l}</p>
            ))}
            <p className="mt-1 text-right text-[9px] font-semibold tracking-wider">{NEGOCIO.servicios}</p>
          </div>
        </header>

        <h1 className="relative mt-6 text-center text-2xl font-extrabold tracking-wide text-brand">Certificado</h1>

        <div className="relative mt-5 flex flex-col gap-4 text-brand-dark">
          <p className="normal-case">
            {NEGOCIO.ciudad}, {fechaCertificado(c.fecha)}
          </p>

          <p>
            Certifico que: <strong>{c.paciente}</strong>
          </p>

          {hayAvh && (
            <div>
              <p>Presenta:</p>
              <div className="mt-1 grid grid-cols-[3rem_1fr] gap-x-3">
                <strong>AVH:</strong>
                <strong>{c.avh_condicion ?? ""}</strong>
                {tiene(c.avh_od) && (
                  <>
                    <span></span>
                    <span><strong className="mr-3">OD:</strong>{c.avh_od}</span>
                  </>
                )}
                {tiene(c.avh_oi) && (
                  <>
                    <span></span>
                    <span><strong className="mr-3">OI:</strong>{c.avh_oi}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {rxConDatos.length > 0 && (
            <div>
              <p>Realizado su examen visual correspondiente tenemos</p>
              <p className="mt-3">
                <strong>RX: {c.rx_tipo ?? ""}</strong>
              </p>
              <table className="mt-1 w-full max-w-sm text-left">
                <thead>
                  <tr className="text-[12px]">
                    <th className="w-10"></th>
                    <th className="py-1 pr-4 font-bold">ESF</th>
                    <th className="py-1 pr-4 font-bold">CIL</th>
                    <th className="py-1 pr-4 font-bold">EJE</th>
                    {mostrarAdd && <th className="py-1 pr-4 font-bold">ADD</th>}
                    <th className="py-1 font-bold">AV.C.C.</th>
                  </tr>
                </thead>
                <tbody>
                  {rxConDatos.map((r) => (
                    <tr key={r.ojo}>
                      <th className="py-0.5 pr-2 text-left font-bold">{r.ojo}:</th>
                      <td className="pr-4">{formatRx("esfera", r.esfera)}</td>
                      <td className="pr-4">{formatRx("cilindro", r.cilindro)}</td>
                      <td className="pr-4">{r.eje != null ? `${r.eje}°` : "—"}</td>
                      {mostrarAdd && <td className="pr-4">{formatRx("add", r.add)}</td>}
                      <td>{r.av ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {dp != null && (
                <p className="mt-2">
                  <strong>DP. {fmtDp(dp)} MM</strong>
                </p>
              )}
            </div>
          )}

          {hayCie && (
            <div>
              <p><strong>Código CIE:</strong></p>
              {tiene(c.cie_od) && <p><strong>OD.</strong> {c.cie_od}</p>}
              {tiene(c.cie_oi) && <p><strong>OI.</strong> {c.cie_oi}</p>}
            </div>
          )}

          <div className="flex flex-col gap-1">
            {tiene(c.test_colores) && <p><strong>Test de colores: {c.test_colores}</strong></p>}
            {c.necesita_lentes != null && (
              <p><strong>{c.necesita_lentes ? "Necesita usar lentes correctores" : "No necesita lentes correctores"}</strong></p>
            )}
            {c.control_meses != null && (
              <p className="underline underline-offset-2 normal-case">
                Se recomienda control {controlCada(c.control_meses)}.
              </p>
            )}
          </div>

          <div className="mt-8">
            <p>Atentamente</p>
            {/* Espacio para firma y sello */}
            <div className="h-24"></div>
            <p className="normal-case"><strong>{c.optometrista ?? ""}</strong></p>
            {c.registro_msp && <p className="normal-case">Reg. M.S.P. # {c.registro_msp}</p>}
          </div>
        </div>

        {/* Pie con los locales */}
        <footer className="relative mt-auto border-t-2 border-brand pt-3 text-center text-[10px] normal-case leading-snug text-brand-dark">
          {NEGOCIO.sucursales.map((s) => (
            <div key={s.ciudad} className="mb-1">
              <p>
                <strong>{s.ciudad}:</strong> {s.locales[0]}
              </p>
              {s.locales.slice(1).map((l) => (
                <p key={l}>{l}</p>
              ))}
            </div>
          ))}
        </footer>
    </article>
  );
}
