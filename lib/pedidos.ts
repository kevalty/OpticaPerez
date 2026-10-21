import { resumenPar } from "@/lib/recetario";
import { fechaLocalCorta } from "@/lib/time";

// Estados del pedido, en orden. Deben coincidir con orden_estados() en la base de datos.
export const ESTADOS_PEDIDO = [
  { id: "enviado_a_hacer", label: "Enviado a hacer", cliente: "Tu pedido fue enviado a hacer", detalle: "Ya registramos tu pedido y lo enviamos a fabricar." },
  { id: "recibido_en_laboratorio", label: "Recibido en el laboratorio", cliente: "Tu pedido está en el laboratorio", detalle: "El laboratorio ya recibió tu pedido y está trabajando en él." },
  { id: "enviado_a_riobamba", label: "Enviado a Riobamba", cliente: "Tu pedido va en camino a Riobamba", detalle: "Tu pedido ya está terminado y viaja a nuestro local de Riobamba." },
  { id: "listo_para_recibir", label: "Listo para recibir", cliente: "¡Tu pedido está listo para recibir!", detalle: "Ya puedes pasar a retirarlo por nuestro local de Riobamba." },
  { id: "entregado", label: "Entregado", cliente: "Pedido entregado", detalle: "Tu pedido fue entregado. ¡Gracias por confiar en nosotros!" },
] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number]["id"];

export const SEDE_ENTREGA = "Riobamba";

export const estadoInfo = (id: string) => ESTADOS_PEDIDO.find((e) => e.id === id) ?? null;
export const indiceEstado = (id: string) => ESTADOS_PEDIDO.findIndex((e) => e.id === id);
export const siguienteEstado = (id: string) => ESTADOS_PEDIDO[indiceEstado(id) + 1] ?? null;
export const anteriorEstado = (id: string) => (indiceEstado(id) > 0 ? ESTADOS_PEDIDO[indiceEstado(id) - 1] : null);

export const BADGE_ESTADO: Record<string, string> = {
  enviado_a_hacer: "bg-slate-100 text-slate-700",
  recibido_en_laboratorio: "bg-amber-100 text-amber-800",
  enviado_a_riobamba: "bg-iris-light text-brand",
  listo_para_recibir: "bg-emerald-100 text-emerald-800",
  entregado: "bg-slate-200 text-slate-600",
};

export type EspecificacionPar = Parameters<typeof resumenPar>[0] | null;
export type Especificaciones = { primaria: EspecificacionPar; segundo: EspecificacionPar } | null;

// Lineas "Diseño: Progresivo", "Tratamiento: Crizal UV"... sin medidas de la Rx.
export function lineasEspecificaciones(spec: Especificaciones): { titulo: string; lineas: string[] }[] {
  const out: { titulo: string; lineas: string[] }[] = [];
  for (const [titulo, par] of [["Lentes principales", spec?.primaria], ["Segundo par", spec?.segundo]] as const) {
    if (!par) continue;
    const r = resumenPar(par);
    const lineas = [
      r.diseno && `Diseño: ${r.diseno}`,
      r.tratamiento && `Tratamiento: ${r.tratamiento}`,
      r.exteriores && `Para exteriores: ${r.exteriores}`,
      r.material && `Material: ${r.material}`,
    ].filter(Boolean) as string[];
    if (lineas.length) out.push({ titulo, lineas });
  }
  return out;
}

// Acepta una fecha ("2026-10-20") o un instante con hora ("2026-10-21T01:49:00Z"; este se muestra en el dia local del negocio).
export const fechaCorta = (iso: string | null | undefined) =>
  !iso ? "" : iso.length > 10 ? fechaLocalCorta(iso) : iso.split("-").reverse().join("/");
