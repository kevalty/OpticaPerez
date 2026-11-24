import Link from "next/link";
import { METODO_ETIQUETA, TIPO_ETIQUETA, type Reporte, type TipoCsv } from "@/lib/reportes";
import { card } from "@/lib/ui";
import { dinero } from "@/lib/ventas";

function Cifra({ valor, titulo, tono = "normal" }: { valor: string | number; titulo: string; tono?: "normal" | "alerta" }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-brand/10 print:ring-brand/30">
      <span className={`block break-words text-2xl font-bold ${tono === "alerta" ? "text-amber-700" : "text-brand"}`}>{valor}</span>
      <span className="text-sm text-brand-dark/70">{titulo}</span>
    </div>
  );
}

// Lista con barra proporcional (sirve en celular y en papel).
function Barras({ filas }: { filas: { clave: string; etiqueta: string; detalle?: string; valor: number }[] }) {
  const max = Math.max(...filas.map((f) => f.valor), 0.01);
  if (filas.length === 0) return <p className="text-sm text-brand-dark/70">No hay ventas en este periodo.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {filas.map((f) => (
        <li key={f.clave} className="break-inside-avoid">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 break-words text-brand">{f.etiqueta}{f.detalle && <span className="ml-2 text-xs text-brand-dark/60">{f.detalle}</span>}</span>
            <span className="shrink-0 font-semibold text-brand">{dinero(f.valor)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-iris-light/60 print:border print:border-brand/20">
            <div className="h-2 rounded-full bg-iris print:bg-brand" style={{ width: `${Math.max(2, (f.valor / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Seccion({ titulo, csv, children }: { titulo: string; csv?: { href: string }; children: React.ReactNode }) {
  return (
    <section className={`${card} flex flex-col gap-3 print:break-inside-avoid print:ring-brand/30`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-brand">{titulo}</h2>
        {csv && <Link href={csv.href} prefetch={false} className="inline-flex min-h-11 items-center text-sm text-iris hover:underline print:hidden">Descargar CSV</Link>}
      </div>
      {children}
    </section>
  );
}

const fechaCorta = (iso: string) => iso.split("-").reverse().join("/");

// Vista del reporte, compartida por la pantalla (con enlaces de descarga) y la hoja para imprimir / guardar como PDF.
export function ReporteVista({ r, csvHref }: { r: Reporte; csvHref?: (t: TipoCsv) => string }) {
  const s = r.resumen;
  const enlace = (t: TipoCsv) => (csvHref ? { href: csvHref(t) } : undefined);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Cifra valor={s.ventas} titulo="Ventas" />
        <Cifra valor={dinero(s.vendido)} titulo="Vendido" />
        <Cifra valor={dinero(s.cobrado)} titulo="Cobrado en el periodo" />
        <Cifra valor={dinero(s.saldo)} titulo="Saldo por cobrar" tono={s.saldo > 0.004 ? "alerta" : "normal"} />
        <Cifra valor={dinero(s.descuentos)} titulo="Descuentos dados" />
      </div>
      <p className="text-xs text-brand-dark/60">
        Solo cuentan las ventas activas{s.anuladas > 0 ? ` (hay ${s.anuladas} anulada${s.anuladas === 1 ? "" : "s"} que no se suman)` : ""}. «Cobrado» son los pagos recibidos dentro del periodo; «saldo» es lo que aún deben las ventas del periodo.
      </p>

      <Seccion titulo="Ventas por día" csv={enlace("dia")}>
        <Barras filas={r.por_dia.map((d) => ({ clave: d.dia, etiqueta: fechaCorta(d.dia), detalle: `${d.ventas} venta${d.ventas === 1 ? "" : "s"}`, valor: d.vendido }))} />
      </Seccion>

      <Seccion titulo="Por tipo de producto" csv={enlace("tipo")}>
        <Barras filas={r.por_tipo.map((t) => ({ clave: t.tipo, etiqueta: TIPO_ETIQUETA[t.tipo] ?? t.tipo, detalle: `${t.cantidad} unid.`, valor: t.total }))} />
      </Seccion>

      <Seccion titulo="Por producto" csv={enlace("producto")}>
        <Barras filas={r.por_producto.slice(0, csvHref ? 15 : 25).map((p, i) => ({ clave: `${i}`, etiqueta: p.nombre, detalle: `${p.cantidad} unid.`, valor: p.total }))} />
        {r.por_producto.length > (csvHref ? 15 : 25) && <p className="text-xs text-brand-dark/60">Se muestran los {csvHref ? 15 : 25} que más vendieron; el CSV trae todos.</p>}
      </Seccion>

      <Seccion titulo="Por vendedor" csv={enlace("vendedor")}>
        <Barras filas={r.por_vendedor.map((v, i) => ({ clave: `${i}`, etiqueta: v.vendedor, detalle: `${v.ventas} venta${v.ventas === 1 ? "" : "s"}${v.saldo > 0.004 ? ` · saldo ${dinero(v.saldo)}` : ""}`, valor: v.vendido }))} />
      </Seccion>

      <Seccion titulo="Cobros por método de pago" csv={enlace("metodo")}>
        <Barras filas={r.por_metodo.map((m) => ({ clave: m.metodo, etiqueta: METODO_ETIQUETA[m.metodo] ?? m.metodo, detalle: `${m.pagos} pago${m.pagos === 1 ? "" : "s"}`, valor: m.total }))} />
      </Seccion>
    </>
  );
}
