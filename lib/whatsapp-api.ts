import { normalizarTelefono } from "@/lib/whatsapp";

// Envio por WhatsApp Business Cloud API (Meta). Las claves viven SOLO en variables de entorno del servidor (Vercel):
//   WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID  (y opcional WHATSAPP_API_VERSION, por defecto v23.0)
export const whatsappConfigurado = () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

export type ResultadoWA = { ok: true; id: string } | { ok: false; error: string };

// WhatsApp no admite saltos de linea, tabuladores ni mas de 4 espacios seguidos dentro de una variable.
const limpio = (t: string) => t.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim().slice(0, 1000) || "-";

function mensajeError(codigo: number | undefined, texto: string | undefined): string {
  switch (codigo) {
    case 190:
    case 102:
    case 463:
    case 467:
      return "La conexión con WhatsApp venció. Avisa al administrador para renovarla.";
    case 131030:
      return "Ese número no está en la lista de destinatarios de prueba de Meta (modo de prueba).";
    case 132001:
      return "La plantilla no existe o todavía no está aprobada en Meta. Revisa su nombre e idioma en WhatsApp → Plantillas.";
    case 132000:
    case 132005:
    case 132007:
    case 132012:
      return "Los datos del mensaje no coinciden con la plantilla creada en Meta (variables o botón).";
    case 131026:
      return "No se pudo entregar: el número no tiene WhatsApp o no puede recibir este mensaje.";
    case 131047:
      return "Pasaron más de 24 horas desde el último mensaje del cliente: hace falta una plantilla aprobada.";
    case 131048:
    case 131056:
      return "Meta limitó temporalmente los envíos. Espera unos minutos e inténtalo de nuevo.";
    default:
      return `WhatsApp rechazó el envío${codigo ? ` (código ${codigo})` : ""}: ${(texto ?? "sin detalle").slice(0, 200)}`;
  }
}

export async function enviarPlantillaWA(p: {
  telefono: string | null | undefined;
  plantilla: string;
  idioma: string;
  cuerpo: string[]; // variables {{1}}, {{2}}... del cuerpo
  urlSufijo?: string; // variable {{1}} del boton de URL dinamica (el codigo de seguimiento)
}): Promise<ResultadoWA> {
  if (!whatsappConfigurado()) return { ok: false, error: "WhatsApp no está configurado en el sistema (modo manual)." };
  const to = normalizarTelefono(p.telefono);
  if (!to) return { ok: false, error: "El paciente no tiene un celular válido." };

  const components: unknown[] = [];
  if (p.cuerpo.length) components.push({ type: "body", parameters: p.cuerpo.map((t) => ({ type: "text", text: limpio(t) })) });
  if (p.urlSufijo) components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: p.urlSufijo }] });

  try {
    const version = process.env.WHATSAPP_API_VERSION ?? "v23.0";
    const r = await fetch(`https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: { name: p.plantilla, language: { code: p.idioma }, ...(components.length ? { components } : {}) },
      }),
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    const j = (await r.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { code?: number; message?: string } };
    if (!r.ok) {
      console.error("whatsapp fallo:", r.status, j.error?.code); // nunca datos del paciente ni el token
      return { ok: false, error: mensajeError(j.error?.code, j.error?.message) };
    }
    const id = j.messages?.[0]?.id;
    return id ? { ok: true, id } : { ok: false, error: "WhatsApp no devolvió confirmación del envío." };
  } catch (e) {
    console.error("whatsapp red:", e instanceof Error ? e.name : "error");
    return { ok: false, error: "No se pudo conectar con WhatsApp. Inténtalo de nuevo." };
  }
}
