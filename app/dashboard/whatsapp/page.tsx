import Link from "next/link";
import { ListaPendientes, ListaPlantillas, ProbarWhatsApp, type PendienteFila, type PlantillaFila } from "@/components/whatsapp-panel";
import { requireRole } from "@/lib/auth";
import { fechaCorta } from "@/lib/pedidos";
import { createClient } from "@/lib/supabase/server";
import { fechaHoraLocal, formatDateLong } from "@/lib/time";
import { card } from "@/lib/ui";
import { whatsappConfigurado } from "@/lib/whatsapp-api";
import { TIPOS_WA, tipoWALabel, type Pendiente } from "@/lib/whatsapp-envios";

export const metadata = { title: "WhatsApp · Óptica Pérez" };

const pad = (n: unknown) => String(n).padStart(6, "0");
const detalleDe = (p: Pendiente): string => {
  const d = p.datos;
  if (p.tipo === "turno") return `${formatDateLong(String(d.fecha))}${d.hora ? ` a las ${d.hora}` : ""}`;
  if (p.tipo === "saldo") return `Venta N.º ${pad(d.numero)} · saldo $${Number(d.saldo).toFixed(2).replace(".", ",")}`;
  if (p.tipo === "control_adaptacion") return "Pedido entregado hace unas semanas";
  return `Última consulta: ${fechaCorta(String(d.ultima))}`;
};

const TABS = [
  { id: "pendientes", titulo: "Pendientes" },
  { id: "historial", titulo: "Historial" },
  { id: "plantillas", titulo: "Plantillas" },
] as const;

export default async function WhatsAppPage({ searchParams }: PageProps<"/dashboard/whatsapp">) {
  const user = await requireRole("recepcionista", "administrador");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.id === sp.tab)?.id ?? "pendientes";
  const esAdmin = user.rol === "administrador";
  const supabase = await createClient();
  const configurado = whatsappConfigurado();

  const { data: pl, error: ePl } = await supabase.from("whatsapp_plantillas").select("tipo, nombre, idioma, activa, descripcion, texto_sugerido");
  if (ePl) console.error("whatsapp_plantillas fallo:", ePl.code);
  const plantillas = TIPOS_WA.map((t) => ({ ...(pl ?? []).find((x) => x.tipo === t.id), tipo: t.id, etiqueta: t.label })).filter((p) => "nombre" in p) as PlantillaFila[];
  const activos = Object.fromEntries(plantillas.map((p) => [p.tipo, p.activa]));

  let pendientes: PendienteFila[] = [];
  let historial: { id: string; tipo: string; estado: string; destino: string; error: string | null; created_at: string; patients: { nombre: string } | null }[] = [];
  if (tab === "pendientes") {
    const { data } = await supabase.rpc("recordatorios_pendientes");
    pendientes = ((data ?? []) as Pendiente[]).map((p) => ({
      tipo: p.tipo, patient_id: p.patient_id, ref_id: p.ref_id, paciente: p.paciente, telefono: p.telefono, etiqueta: tipoWALabel(p.tipo), detalle: detalleDe(p),
    }));
  } else if (tab === "historial") {
    const { data } = await supabase.from("whatsapp_envios").select("id, tipo, estado, destino, error, created_at, patients(nombre)").order("created_at", { ascending: false }).limit(100);
    historial = (data ?? []) as unknown as typeof historial;
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-brand">WhatsApp</h1>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${configurado ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
          {configurado ? "Conectado a Meta" : "Modo manual (sin conexión a Meta)"}
        </span>
      </div>
      {ePl && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Falta actualizar la base de datos (migración 0013). Avisa al administrador.</p>}
      {!configurado && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Faltan las claves de WhatsApp en el servidor: los avisos de pedido se envían con los botones manuales.</p>}

      <nav aria-label="Secciones" className="flex gap-2 border-b border-brand/10 pb-3">
        {TABS.map((t) => (
          <Link key={t.id} href={`/dashboard/whatsapp?tab=${t.id}`} aria-current={tab === t.id ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-medium ${tab === t.id ? "bg-brand text-white" : "text-brand hover:bg-iris-light"}`}>{t.titulo}</Link>
        ))}
      </nav>

      {tab === "pendientes" && (
        <>
          <p className="text-sm text-brand-dark/70">Solo aparecen pacientes que aceptaron WhatsApp y que aún no recibieron ese mismo aviso. Cada envío queda en el historial.</p>
          <ListaPendientes filas={pendientes} activos={activos} />
        </>
      )}

      {tab === "historial" && (
        <section className={card}>
          {historial.length === 0 ? <p className="text-sm text-brand-dark/70">Todavía no se ha enviado ningún mensaje.</p> : (
            <ul className="divide-y divide-brand/10 text-sm">
              {historial.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span><strong className="text-brand">{h.patients?.nombre ?? "—"}</strong> · {tipoWALabel(h.tipo)} · {h.destino}</span>
                  <span className="flex items-center gap-2 text-brand-dark/60">
                    {fechaHoraLocal(h.created_at)}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${h.estado === "enviado" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>{h.estado === "enviado" ? "Enviado" : "Falló"}</span>
                  </span>
                  {h.error && <span className="w-full text-xs text-red-700">{/Vercel/.test(h.error) ? "La conexión con WhatsApp venció. Avisa al administrador para renovarla." : h.error}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "plantillas" && (
        <>
          <p className="text-sm text-brand-dark/70">Meta debe aprobar cada plantilla antes de usarla. Aquí se registra su nombre exacto y se activa cuando esté aprobada.</p>
          <ListaPlantillas plantillas={plantillas} editable={esAdmin} />
          {esAdmin && configurado && <ProbarWhatsApp />}
        </>
      )}
    </>
  );
}
