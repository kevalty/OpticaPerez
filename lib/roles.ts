export type Role = "recepcionista" | "doctor" | "administrador" | "otro";

export const ROLE_LABEL: Record<Role, string> = {
  recepcionista: "Recepcionista",
  doctor: "Doctor / Optometrista",
  administrador: "Administrador",
  otro: "Personal",
};

// Solo para mostrar u ocultar la UI. La barrera real son las politicas RLS en la base de datos.
export const MODULES: { id: string; titulo: string; detalle: string; roles: Role[]; semana: number; href?: string }[] = [
  { id: "pacientes", titulo: "Pacientes", detalle: "Registro y perfil de pacientes", roles: ["recepcionista", "doctor", "administrador"], semana: 2, href: "/dashboard/pacientes" },
  { id: "turnos", titulo: "Turnos", detalle: "Agenda y paso al consultorio", roles: ["recepcionista", "doctor", "administrador"], semana: 2, href: "/dashboard/turnos" },
  { id: "ventas", titulo: "Ventas", detalle: "Ventas y órdenes de trabajo", roles: ["recepcionista", "otro", "administrador"], semana: 4 },
  { id: "pedidos", titulo: "Pedidos", detalle: "Seguimiento de lentes", roles: ["recepcionista", "doctor", "administrador", "otro"], semana: 5 },
  { id: "inventario", titulo: "Inventario", detalle: "Productos y stock", roles: ["recepcionista", "administrador", "otro"], semana: 7 },
  { id: "admin", titulo: "Administración", detalle: "Usuarios, reportes y configuración", roles: ["administrador"], semana: 8 },
];
