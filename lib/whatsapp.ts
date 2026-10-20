import { NEGOCIO } from "@/lib/negocio";
import { SEDE_ENTREGA } from "@/lib/pedidos";

// "0990000001" -> "593990000001" (formato internacional que pide WhatsApp). Devuelve null si no parece un telefono.
export function normalizarTelefono(t: string | null | undefined): string | null {
  const d = (t ?? "").replace(/\D/g, "");
  if (d.length < 9 || d.length > 15) return null;
  if (d.startsWith("593")) return d;
  if (d.startsWith("0")) return `593${d.slice(1)}`;
  if (d.length === 9) return `593${d}`; // celular sin el 0 inicial
  return d;
}

// Abre WhatsApp (celular o web) con el mensaje ya escrito. No necesita cuenta de desarrollador de Meta.
export function waLink(telefono: string | null | undefined, texto: string): string | null {
  const n = normalizarTelefono(telefono);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(texto)}` : null;
}

const money = (n: number) => `$${n.toFixed(2).replace(".", ",")}`;

// Primer mensaje: al cerrar la venta, a modo de recibo.
export function mensajeRecibo(d: { nombre: string; numero: number; link: string }): string {
  return `Hola ${d.nombre} 👋, gracias por confiar en *${NEGOCIO.nombre}*.\n\nTu pedido N.º ${String(d.numero).padStart(6, "0")} fue *enviado a hacer*. Aquí puedes ver el detalle y cómo avanza:\n${d.link}`;
}

// Segundo mensaje: cuando el pedido esta listo en la sede.
export function mensajeListo(d: { nombre: string; numero: number; link: string; saldo: number }): string {
  const local = NEGOCIO.sucursales[0]?.locales[0]?.replace(/ - .*$/, "") ?? "";
  const saldo = d.saldo > 0 ? `\nSaldo pendiente: ${money(d.saldo)}.` : "";
  return `Hola ${d.nombre} 😊, ¡tu pedido N.º ${String(d.numero).padStart(6, "0")} ya está *listo para recibir* en nuestro local de ${SEDE_ENTREGA}!\n${local}${saldo}\n\nDetalle de tu pedido:\n${d.link}`;
}
