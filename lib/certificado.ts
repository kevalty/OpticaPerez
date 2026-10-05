const MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

// "2026-09-19" -> "19 de SEPTIEMBRE del 2026" (como en el certificado impreso de Optica Perez)
export function fechaCertificado(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MESES[m - 1]} del ${y}`;
}

const NUMEROS = [
  "", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ", "ONCE", "DOCE", "TRECE",
  "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE", "VEINTIUN", "VEINTIDOS",
  "VEINTITRES", "VEINTICUATRO",
];

// 8 -> "cada OCHO meses", 1 -> "cada mes"
export function controlCada(meses: number): string {
  if (meses === 1) return "cada mes";
  return `cada ${NUMEROS[meses] ?? meses} meses`;
}

type Rx = { ojo: string; esfera: number | null; cilindro: number | null; eje: number | null; av: string | null; add: number | null; dp: number | null };

// El certificado imprime una sola D.P. (p. ej. "67 MM").
//  - Si el doctor anoto la D.P. de cada ojo (valores monoculares, menores de 45), se suman.
//  - Si anoto un solo valor (o valores binoculares), se usa el primero que haya.
export function dpTotal(rx: Rx[]): number | null {
  const od = rx.find((r) => r.ojo === "OD")?.dp ?? null;
  const oi = rx.find((r) => r.ojo === "OI")?.dp ?? null;
  if (od != null && oi != null && od < 45 && oi < 45) return od + oi;
  return od ?? oi;
}

export function fmtDp(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
