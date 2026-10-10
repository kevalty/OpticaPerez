import type { CertificadoDatos } from "@/components/certificado-doc";
import { NEGOCIO } from "@/lib/negocio";
import {
  DISENOS,
  EXTERIORES,
  MATERIALES,
  REC_COLUMNAS,
  REC_OJOS,
  TRATAMIENTOS,
  type Par,
} from "@/lib/recetario";

// "2026-09-19" -> "19/09/2026" (D/M/A como en la hoja)
const dmy = (iso: string) => iso.split("-").reverse().join("/");

const caja = (marcado: boolean) => (
  <span aria-hidden className={`mr-1 inline-block size-3 shrink-0 rounded-full border border-brand align-[-1px] ${marcado ? "bg-brand" : ""}`} />
);

function Opciones({ titulo, opciones, activos, otro, detalle }: { titulo: string; opciones: { id: string; label: string }[]; activos: string[]; otro?: boolean; detalle?: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="w-24 shrink-0 font-bold text-brand">{titulo}:</span>
      {opciones.map((o) => (
        <span key={o.id} className="whitespace-nowrap">
          {caja(activos.includes(o.id))}
          {o.label}
        </span>
      ))}
      {otro && (
        <span className="whitespace-nowrap">
          {caja(activos.includes("otro"))}Otro{detalle ? `: ${detalle}` : ""}
        </span>
      )}
    </div>
  );
}

function Tabla({ par }: { par: Par | null }) {
  return (
    <table className="w-full border-collapse text-center text-[10px]">
      <thead>
        <tr className="text-brand">
          <th className="border border-brand/40 p-0.5"></th>
          {REC_COLUMNAS.map((c) => (
            <th key={c.key} className="border border-brand/40 p-0.5 font-semibold">{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {REC_OJOS.map((o) => (
          <tr key={o.id} className="h-6">
            <th className="border border-brand/40 p-0.5 text-brand">{o.id}</th>
            {REC_COLUMNAS.map((c) => (
              <td key={c.key} className="border border-brand/40 p-0.5">{par?.[o.suf][c.key] ?? ""}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Seccion({ titulo, par, segundo }: { titulo: string; par: Par | null; segundo?: boolean }) {
  const dis = par?.diseno ? [par.diseno] : [];
  const detalleDis = par?.diseno_detalle;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="w-fit rounded-r-full bg-brand px-4 py-0.5 text-sm font-bold text-white">{titulo}</h2>
      <Tabla par={par} />
      <div className="flex flex-col gap-1">
        <Opciones titulo="Diseño" opciones={segundo ? DISENOS : DISENOS.slice(0, 2)} activos={dis} detalle={detalleDis} />
        <Opciones titulo="Tratamiento" opciones={segundo ? TRATAMIENTOS.filter((t) => t.id !== "xperio") : TRATAMIENTOS} activos={par?.tratamientos ?? []} otro detalle={par?.tratamiento_otro} />
        {segundo && <Opciones titulo="Para exteriores" opciones={EXTERIORES} activos={par?.exteriores ?? []} detalle={par?.exteriores_detalle} />}
        <Opciones titulo="Material" opciones={MATERIALES} activos={par?.material ? [par.material] : []} otro detalle={par?.material_otro} />
      </div>
    </section>
  );
}

const Linea = ({ k, v }: { k: string; v?: string | null }) => (
  <div className="flex items-end gap-2">
    <span className="shrink-0 text-brand">{k}:</span>
    <span className="min-h-4 flex-1 border-b border-brand/40 px-1 font-medium">{v ?? ""}</span>
  </div>
);

// Hoja "RECETARIO" para el laboratorio. Horizontal (A4 apaisado). Lo que el doctor no lleno queda en blanco.
export function RecetarioDoc({ c }: { c: CertificadoDatos }) {
  const r = c.recetario;
  const direccionOptica = NEGOCIO.sucursales[0]?.locales[0]?.replace(/ - .*$/, "").replace(/^Local \d+:\s*/, "") ?? "";
  return (
    <article className="mx-auto flex w-full max-w-[297mm] flex-col gap-3 bg-white px-8 py-6 text-[11px] leading-snug text-brand-dark ring-1 ring-brand/10 print:max-w-none print:px-0 print:py-0 print:ring-0">
      <style>{`@media print { @page { size: A4 landscape; margin: 10mm; } }`}</style>

      <header className="flex items-end justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-wide text-brand">RECETARIO</h1>
        <div className="flex gap-6 text-xs">
          <div className="min-w-36 border-b border-brand/40 text-center">{dmy(c.fecha)}</div>
          <div className="min-w-36 border-b border-brand/40 text-center">{r?.fecha_entrega ? dmy(r.fecha_entrega) : ""}</div>
        </div>
      </header>
      <div className="-mt-2 flex justify-end gap-6 pr-0 text-[9px] text-brand">
        <span className="min-w-36 text-center">Fecha</span>
        <span className="min-w-36 text-center">Fecha de entrega</span>
      </div>

      <section className="flex flex-col gap-1.5">
        <h2 className="w-fit rounded-r-full bg-brand px-4 py-0.5 text-sm font-bold text-white">Información del Paciente</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          <div className="col-span-2"><Linea k="Nombre" v={c.paciente} /></div>
          <Linea k="Dirección" v={c.direccion} />
          <Linea k="Ciudad" v={NEGOCIO.ciudad} />
          <Linea k="Teléfono" v={c.telefono} />
          <Linea k="Correo electrónico" v={c.email} />
          <Linea k="País" v="Ecuador" />
          <Linea k={c.tipo_documento === "pasaporte" ? "Pasaporte" : "Cédula"} v={c.documento} />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-6 print:break-inside-avoid">
        <Seccion titulo="Prescripción Primaria" par={r?.primaria ?? null} />
        <Seccion titulo="Segundo Par" par={r?.segundo ?? null} segundo />
      </div>

      <section className="flex flex-col gap-1.5">
        <h2 className="w-fit rounded-r-full bg-brand px-4 py-0.5 text-sm font-bold text-white">Información de la Óptica</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          <Linea k="Óptica" v={NEGOCIO.nombre} />
          <Linea k="Asesor" />
          <Linea k="Dirección" v={direccionOptica} />
          <Linea k="Teléfono" v={NEGOCIO.sucursales[0]?.locales[0]?.match(/(\d[\d-]{6,})\s*$/)?.[1] ?? ""} />
          <Linea k="Ciudad" v={NEGOCIO.ciudad} />
          <Linea k="Correo electrónico" v={NEGOCIO.correo} />
        </div>
      </section>
    </article>
  );
}
