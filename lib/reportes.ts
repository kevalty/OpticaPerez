import { shiftDate } from "@/lib/time";

export type Reporte = {
  desde: string;
  hasta: string;
  resumen: { ventas: number; vendido: number; descuentos: number; cobrado: number; saldo: number; anuladas: number };
  por_dia: { dia: string; ventas: number; vendido: number }[];
  por_producto: { nombre: string; tipo: string | null; cantidad: number; total: number }[];
  por_tipo: { tipo: string; cantidad: number; total: number }[];
  por_vendedor: { vendedor: string; ventas: number; vendido: number; saldo: number }[];
  por_metodo: { metodo: string; pagos: number; total: number }[];
  ventas: { numero: number; fecha: string; vendedor: string; total: number; descuento: number; pagado: number; saldo: number }[];
};

export const TIPOS_CSV = ["ventas", "dia", "producto", "tipo", "vendedor", "metodo"] as const;
export type TipoCsv = (typeof TIPOS_CSV)[number];

const pad = (n: number) => String(n).padStart(2, "0");

// Atajos de periodo, calculados con la fecha local del negocio (la que llega como "hoy").
export function rangosRapidos(hoy: string): { id: string; label: string; desde: string; hasta: string }[] {
  const [y, m] = hoy.split("-").map(Number);
  const inicioMes = `${y}-${pad(m)}-01`;
  const inicioMesPasado = m === 1 ? `${y - 1}-12-01` : `${y}-${pad(m - 1)}-01`;
  const dow = new Date(`${hoy}T12:00:00Z`).getUTCDay(); // 0 = domingo
  const inicioSemana = shiftDate(hoy, -((dow + 6) % 7)); // lunes
  return [
    { id: "hoy", label: "Hoy", desde: hoy, hasta: hoy },
    { id: "ayer", label: "Ayer", desde: shiftDate(hoy, -1), hasta: shiftDate(hoy, -1) },
    { id: "semana", label: "Esta semana", desde: inicioSemana, hasta: hoy },
    { id: "mes", label: "Este mes", desde: inicioMes, hasta: hoy },
    { id: "mes_pasado", label: "Mes pasado", desde: inicioMesPasado, hasta: shiftDate(inicioMes, -1) },
    { id: "30", label: "Últimos 30 días", desde: shiftDate(hoy, -29), hasta: hoy },
  ];
}

export const TIPO_ETIQUETA: Record<string, string> = { montura: "Monturas", gafa: "Gafas", lente: "Lentes", insumo: "Insumos", servicio: "Servicios", otro: "Otros" };
export const METODO_ETIQUETA: Record<string, string> = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia", otro: "Otro" };

// ---------- CSV ----------
// Separador ";" y coma decimal (Excel en español lo abre en columnas). BOM para que respete las tildes.
// Los textos que empiezan con = + - @ se neutralizan para que Excel no los trate como formula.
const celda = (v: string | number): string => {
  if (typeof v === "number") return String(Math.round(v * 100) / 100).replace(".", ",");
  let t = v.replace(/\r?\n/g, " ");
  if (/^[=+\-@\t]/.test(t)) t = `'${t}`;
  return `"${t.replace(/"/g, '""')}"`; // los textos siempre van entre comillas (y los que empiezan con = + - @ con apostrofo delante)
};

export function aCsv(filas: (string | number)[][]): string {
  return "﻿" + filas.map((f) => f.map(celda).join(";")).join("\r\n") + "\r\n";
}

export function filasCsv(tipo: TipoCsv, r: Reporte): (string | number)[][] {
  switch (tipo) {
    case "dia":
      return [["Día", "Ventas", "Vendido"], ...r.por_dia.map((x) => [x.dia, x.ventas, x.vendido])];
    case "producto":
      return [["Producto", "Tipo", "Cantidad", "Total vendido"], ...r.por_producto.map((x) => [x.nombre, TIPO_ETIQUETA[x.tipo ?? "otro"] ?? "Otros", x.cantidad, x.total])];
    case "tipo":
      return [["Tipo", "Cantidad", "Total vendido"], ...r.por_tipo.map((x) => [TIPO_ETIQUETA[x.tipo] ?? x.tipo, x.cantidad, x.total])];
    case "vendedor":
      return [["Vendedor", "Ventas", "Vendido", "Saldo pendiente"], ...r.por_vendedor.map((x) => [x.vendedor, x.ventas, x.vendido, x.saldo])];
    case "metodo":
      return [["Método de pago", "Pagos", "Total cobrado"], ...r.por_metodo.map((x) => [METODO_ETIQUETA[x.metodo] ?? x.metodo, x.pagos, x.total])];
    default:
      return [["N.º", "Fecha", "Vendedor", "Total", "Descuento", "Pagado", "Saldo"], ...r.ventas.map((x) => [String(x.numero).padStart(6, "0"), x.fecha, x.vendedor, x.total, x.descuento, x.pagado, x.saldo])];
  }
}
