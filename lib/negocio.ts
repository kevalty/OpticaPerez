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
