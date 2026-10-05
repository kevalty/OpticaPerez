import { inputCls } from "@/lib/ui";

// Campos para dar un turno: fecha, hora y optometrista. Sin estado de cliente (sirve en server y client).
export function TurnoFields({ hoy, optometristas }: { hoy: string; optometristas: { id: string; nombre: string }[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-brand">
          Fecha del turno
          <input type="date" name="fecha" defaultValue={hoy} min={hoy} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-brand">
          Hora (opcional si es hoy)
          <input type="time" name="hora" className={inputCls} />
        </label>
      </div>
      <p className="text-xs text-brand-dark/60">
        Si el paciente está aquí ahora, deja la hora vacía y pasa directo a la lista de espera de hoy. Para agendar
        (mañana, el mes que viene…) indica fecha y hora: el turno queda como “agendado” hasta que llegue.
      </p>
      <label className="flex flex-col gap-1 text-sm text-brand">
        Optometrista
        <select name="optometrista_id" defaultValue="" className={inputCls}>
          <option value="">Cualquiera disponible</option>
          {optometristas.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nombre}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
