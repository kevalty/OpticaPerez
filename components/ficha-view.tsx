import { REC_COLUMNAS, resumenPar, type Par, type Recetario } from "@/lib/recetario";
import { PARES, RX_CAMPOS, formatRx, type ClRow, type Ficha, type RxRow } from "@/lib/ficha";

const val = (v: string | number | boolean | null | undefined) => (v == null || v === "" ? "—" : String(v));

// Vista de solo lectura de una ficha medica ya guardada.
export function FichaView({ ficha, rx, cl }: { ficha: Ficha; rx: RxRow[]; cl: ClRow[] }) {
  const filas = PARES.filter((p) => ficha[`${p.key}_od`] || ficha[`${p.key}_oi`]);
  const color = rx.find((r) => r.color)?.color;
  const bifocal = rx.some((r) => r.bifocal);
  const conRx = rx.some((r) => RX_CAMPOS.some((c) => r[c.key] != null && r[c.key] !== ""));
  const recetario = (ficha as unknown as { recetario?: Recetario | null }).recetario ?? null;
  const conCl = cl.some((r) => r.prueba || r.av);

  return (
    <div className="flex flex-col gap-4 text-sm">
      {ficha.observaciones && (
        <section>
          <h4 className="font-semibold text-brand">Observaciones</h4>
          <p className="whitespace-pre-wrap text-brand-dark">{ficha.observaciones}</p>
        </section>
      )}

      {filas.length > 0 && (
        <table className="w-full max-w-lg text-left">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-brand-dark/50">
              <th className="py-1 pr-3 font-medium"></th>
              <th className="py-1 pr-3 font-medium">OD</th>
              <th className="py-1 font-medium">OI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand/10">
            {filas.map((p) => (
              <tr key={p.key}>
                <th className="py-1 pr-3 font-medium text-brand">{p.label}</th>
                <td className="py-1 pr-3">{val(ficha[`${p.key}_od`])}</td>
                <td className="py-1">{val(ficha[`${p.key}_oi`])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {conRx && (
        <section>
          <h4 className="font-semibold text-brand">Rx</h4>
          <table className="w-full max-w-lg text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-brand-dark/50">
                <th className="py-1 pr-3 font-medium">Ojo</th>
                {RX_CAMPOS.map((c) => (
                  <th key={c.key} className="py-1 pr-3 font-medium">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand/10">
              {rx.map((r) => (
                <tr key={r.ojo}>
                  <th className="py-1 pr-3 font-medium text-brand">{r.ojo}</th>
                  {RX_CAMPOS.map((c) => (
                    <td key={c.key} className="py-1 pr-3">
                      {formatRx(c.key, r[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-brand-dark/70">
            Color de lente: {val(color)} · Bifocal: {bifocal ? "Sí" : "No"}
          </p>
        </section>
      )}

      {conCl && (
        <section>
          <h4 className="font-semibold text-brand">Lente de contacto</h4>
          <ul className="text-brand-dark">
            {cl.map((r) => (
              <li key={r.ojo}>
                {r.ojo}: prueba {val(r.prueba)} · A.V. {val(r.av)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(ficha.avh_od || ficha.avh_oi || ficha.avh_condicion || ficha.cie_od || ficha.cie_oi || ficha.test_colores || ficha.necesita_lentes != null || ficha.control_meses) && (
        <section>
          <h4 className="font-semibold text-brand">Datos del certificado</h4>
          <ul className="text-brand-dark">
            {(ficha.avh_condicion || ficha.avh_od || ficha.avh_oi) && (
              <li>
                A.V. habitual: {val(ficha.avh_condicion)} · OD {val(ficha.avh_od)} · OI {val(ficha.avh_oi)}
              </li>
            )}
            {ficha.rx_tipo && <li>Rx: {ficha.rx_tipo}</li>}
            {(ficha.cie_od || ficha.cie_oi) && (
              <li>
                Código CIE: OD {val(ficha.cie_od)} · OI {val(ficha.cie_oi)}
              </li>
            )}
            {ficha.test_colores && <li>Test de colores: {ficha.test_colores}</li>}
            {ficha.necesita_lentes != null && <li>{ficha.necesita_lentes ? "Necesita usar lentes correctores" : "No necesita lentes correctores"}</li>}
            {ficha.control_meses && <li>Control cada {ficha.control_meses} meses</li>}
          </ul>
        </section>
      )}

      {recetario && <RecetarioResumen r={recetario} />}

      {ficha.recomendaciones && (
        <section>
          <h4 className="font-semibold text-brand">Recomendaciones</h4>
          <p className="whitespace-pre-wrap text-brand-dark">{ficha.recomendaciones}</p>
        </section>
      )}
      {ficha.indicaciones_recepcion && (
        <section>
          <h4 className="font-semibold text-brand">Indicaciones para recepción</h4>
          <p className="whitespace-pre-wrap text-brand-dark">{ficha.indicaciones_recepcion}</p>
        </section>
      )}
    </div>
  );
}

function ParResumen({ titulo, p }: { titulo: string; p: Par }) {
  const r = resumenPar(p);
  const cols = REC_COLUMNAS.filter((c) => p.od[c.key] || p.oi[c.key]);
  return (
    <div>
      <p className="font-medium text-brand">{titulo}</p>
      {cols.length > 0 && (
        <table className="w-full max-w-lg text-left">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-brand-dark/50">
              <th className="py-1 pr-3 font-medium">Ojo</th>
              {cols.map((c) => <th key={c.key} className="py-1 pr-3 font-medium">{c.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand/10">
            {(["od", "oi"] as const).map((o) => (
              <tr key={o}>
                <th className="py-1 pr-3 font-medium text-brand">{o.toUpperCase()}</th>
                {cols.map((c) => <td key={c.key} className="py-1 pr-3">{val(p[o][c.key])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ul className="text-brand-dark">
        {r.diseno && <li>Diseño: {r.diseno}</li>}
        {r.tratamiento && <li>Tratamiento: {r.tratamiento}</li>}
        {r.exteriores && <li>Para exteriores: {r.exteriores}</li>}
        {r.material && <li>Material: {r.material}</li>}
      </ul>
    </div>
  );
}

function RecetarioResumen({ r }: { r: Recetario }) {
  return (
    <section className="flex flex-col gap-3">
      <h4 className="font-semibold text-brand">Recetario de lentes{r.fecha_entrega ? ` · entrega ${r.fecha_entrega.split("-").reverse().join("/")}` : ""}</h4>
      {r.primaria && <ParResumen titulo="Prescripción primaria" p={r.primaria} />}
      {r.segundo && <ParResumen titulo="Segundo par" p={r.segundo} />}
    </section>
  );
}
