// Iconos de linea (24x24) para el panel. Decorativos: el nombre siempre va escrito al lado.
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

const ICONOS: Record<string, React.ReactNode> = {
  pacientes: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19c.4-3.3 3-5.2 6-5.2s5.6 1.9 6 5.2" />
      <circle cx="17.2" cy="9" r="2.3" />
      <path d="M17.5 14.2c2 .2 3.3 1.7 3.5 4" />
    </>
  ),
  turnos: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="m9.5 15 1.8 1.8 3.4-3.6" />
    </>
  ),
  fichas: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2.5" />
      <path d="M9 4V3h6v1M9 10h6M9 14h6M9 17.5h3" />
    </>
  ),
  ventas: (
    <>
      <path d="M5 8h14l-1 12H6L5 8Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </>
  ),
  pedidos: (
    <>
      <path d="m12 3 8 4.2v9.6L12 21l-8-4.2V7.2L12 3Z" />
      <path d="m4 7.2 8 4.3 8-4.3M12 11.5V21" />
    </>
  ),
  inventario: (
    <>
      <rect x="3.5" y="12" width="7" height="8" rx="1.2" />
      <rect x="13.5" y="12" width="7" height="8" rx="1.2" />
      <rect x="8.5" y="4" width="7" height="8" rx="1.2" />
    </>
  ),
  admin: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </>
  ),
  inicio: (
    <>
      <path d="M4 11 12 4l8 7" />
      <path d="M6 10v10h12V10M10 20v-5h4v5" />
    </>
  ),
};

export function Icono({ id, className = "size-6" }: { id: string; className?: string }) {
  return (
    <svg {...base} className={className}>
      {ICONOS[id] ?? ICONOS.fichas}
    </svg>
  );
}
