import { shiftDate } from "@/lib/time";

export type RegistroAuditoria = {
  id: number;
  created_at: string;
  accion: "ver" | "crear" | "editar" | "eliminar";
  tabla: string;
  registro_id: string | null;
  usuario: string;
  rol: string | null;
  paciente: string | null;
};

export type RevisionSeguridad = {
  tablas: number;
  tablas_sin_rls: string[];
  tablas_sin_politicas: string[];
  funciones_sin_search_path: string[];
  funciones_publicas: string[];
  tablas_con_acceso_anonimo: string[];
  buckets_publicos: string[];
  administradores_activos: number;
  usuarios_activos: number;
};

export const TABLA_ETIQUETA: Record<string, string> = {
  medical_records: "Ficha médica",
  patients: "Paciente",
  sales: "Venta",
  sale_payments: "Pago",
  orders: "Pedido",
  products: "Producto",
  users: "Usuario",
  order_fotos: "Foto de entrega",
  entrega_confirmaciones: "Confirmación de entrega",
};
export const ACCION_ETIQUETA: Record<string, string> = { ver: "Vio", crear: "Creó", editar: "Editó", eliminar: "Eliminó" };

// Pantalla a la que lleva un registro (solo donde existe una pagina para ese dato).
export function hrefRegistro(tabla: string, id: string | null): string | null {
  if (!id) return null;
  const base: Record<string, string> = { medical_records: "/dashboard/fichas", patients: "/dashboard/pacientes", sales: "/dashboard/ventas", orders: "/dashboard/pedidos", products: "/dashboard/productos" };
  return base[tabla] ? `${base[tabla]}/${id}` : null;
}

// Funciones que el publico (sin sesion) SI debe poder ejecutar: seguimiento del cliente y control del inicio de sesion.
export const FUNCIONES_PUBLICAS_PREVISTAS = ["confirmar_entrega", "entrega_foto_publica", "login_estado", "login_fallo", "seguimiento_foto_path", "seguimiento_publico"];

export const rangosAuditoria = (hoy: string) => [
  { id: "hoy", label: "Hoy", desde: hoy, hasta: hoy },
  { id: "7", label: "Últimos 7 días", desde: shiftDate(hoy, -6), hasta: hoy },
  { id: "30", label: "Últimos 30 días", desde: shiftDate(hoy, -29), hasta: hoy },
];
