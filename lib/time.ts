// Zona horaria del negocio. "Hoy" debe ser la fecha local, no la del servidor (UTC en Vercel).
// Se puede cambiar con la variable de entorno APP_TIMEZONE.
const TZ = process.env.APP_TIMEZONE ?? "America/Guayaquil";

export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function nowTime(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
}

export function isISODate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDateLong(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Inicio y fin (instantes UTC, ISO) del dia local "fecha" en la zona del negocio. Para filtrar columnas timestamptz por dia.
export function rangoDia(iso: string): { desde: string; hasta: string } {
  const inicio = (dia: string) => {
    const guess = new Date(`${dia}T00:00:00Z`);
    const partes = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" }).formatToParts(guess);
    const off = partes.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    const m = off.match(/GMT([+-])(\d{2}):?(\d{2})?/);
    const minutos = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0;
    return new Date(guess.getTime() - minutos * 60_000).toISOString();
  };
  return { desde: inicio(iso), hasta: inicio(shiftDate(iso, 1)) };
}

export function horaLocal(ts: string): string {
  return new Intl.DateTimeFormat("es", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ts));
}

export function fechaHoraLocal(ts: string): string {
  return new Intl.DateTimeFormat("es", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" }).format(new Date(ts));
}

// "2026-10-20T01:49:00Z" -> "19/10/2026" (dia local del negocio, no el UTC)
export function fechaLocalCorta(ts: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(ts));
}
