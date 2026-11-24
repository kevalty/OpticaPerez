// Datos de la optica que se imprimen en el certificado. Mas adelante se editaran desde el panel
// administrativo (semana 8); mientras tanto viven aqui.
export const NEGOCIO = {
  nombre: "OPTICA PEREZ",
  lineas: ["CENTRO DE OPTOMETRIA - CONTACTOLOGIA", "Examen Visual Computarizado", "MULTIPLES SERVICIOS"],
  // Correo que sale en "Informacion de la optica" del recetario (opcional, variable OPTICA_CORREO).
  correo: process.env.OPTICA_CORREO ?? "",
  servicios: "OFTALMOLOGIA - CONTACTOLOGIA - OPTOMETRIA - OPTICA POR COMPUTACION",
  // Ciudad que sale en "Riobamba, 19 de SEPTIEMBRE del 2026". Se puede cambiar con OPTICA_CIUDAD.
  ciudad: process.env.OPTICA_CIUDAD ?? "Riobamba",
  sucursales: [
    {
      ciudad: "RIOBAMBA",
      locales: [
        "Local 1: Primera Constituyente Nº 27-13 y Pichincha - Telefax: 03-2960-881",
        "Local 2: Primera Constituyente Nº 27-43 y Rocafuerte - 099 899 8211",
      ],
    },
    {
      ciudad: "QUITO",
      locales: [
        "Local 1: San Gregorio y Versalles (Centro Comercial Quitus, local 497) - 02 512 7178 / 099 929 7968",
        "Local 2: Av. 6 de Diciembre (Multicentro) - 02 243 8590 / 099 929 7968",
      ],
    },
  ],
};

// ---------------------------------------------------------------------------------------------------------------
// POR CONFIRMAR CON EL CLIENTE (maqueta, nov. 2026): descuentos de los mensajes de WhatsApp y texto de la garantia.
// Mas adelante se editaran desde el panel administrativo.
// ---------------------------------------------------------------------------------------------------------------
export const PROMOCIONES = {
  descuentoCumpleanos: "10 %", // mensaje de cumpleanos
  descuentoRenovacion: "10 %", // renovacion de lunas (a partir de los 6 meses de la entrega)
};

// Condiciones de garantia que el cliente ve y acepta al recibir su pedido (por su enlace o en el iPad de la optica).
// TEXTO DE EJEMPLO: la optica debe entregar el texto real (meses de cobertura, que cubre y que no).
export const GARANTIA = {
  meses: 6,
  titulo: "Garantía de tu pedido",
  puntos: [
    "Tus lentes y montura tienen garantía de 6 meses contra defectos de fabricación.",
    "Cubre fallas del material o del armado; no cubre golpes, caídas, rayones por mal uso ni pérdida.",
    "Para hacerla efectiva presenta tu comprobante o el N.º de tu pedido en cualquiera de nuestros locales.",
    "Si sientes molestias al adaptarte, vuelve a vernos: revisamos y ajustamos tus lentes sin costo.",
  ],
};
