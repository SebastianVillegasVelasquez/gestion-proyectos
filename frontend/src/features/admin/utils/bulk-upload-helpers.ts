// Ayudas para la carga masiva de usuarios: plantilla CSV descargable y un
// prompt en español para que el admin le pida a cualquier LLM que arme el
// archivo por él, sin tener que conocer el formato de memoria.

const BOM = "﻿";

const TEMPLATE_ROWS = [
  ["email", "nombre", "apellido", "cedula", "cargo", "password"],
  ["ana.garcia@empresa.com", "Ana", "Garcia", "1020304050", "Desarrolladora", ""],
  ["carlos.lopez@empresa.com", "Carlos", "Lopez", "", "Diseñador", ""],
];

export function buildUsersCsvTemplate(): string {
  const body = TEMPLATE_ROWS.map((row) => row.join(",")).join("\r\n");
  return `${BOM}${body}\r\n`;
}

export function downloadCsvTemplate(): void {
  const blob = new Blob([buildUsersCsvTemplate()], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "plantilla_usuarios.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const USERS_CSV_LLM_PROMPT = `Necesito que generes un archivo CSV para cargar usuarios en un sistema. Sigue estas reglas exactamente:

1. La primera línea debe ser el encabezado, exactamente así: email,nombre,apellido,cedula,cargo,password
2. Cada línea siguiente representa una persona.
3. Columnas obligatorias: email, nombre, apellido.
4. Columnas opcionales (déjalas vacías si no las tengo): cedula, cargo, password. Si dejo "password" vacío, el sistema genera una contraseña temporal automáticamente.
5. Usa coma como separador. Si un valor contiene una coma, enciérralo entre comillas dobles.
6. No traduzcas ni renombres el encabezado, no agregues columnas extra ni una columna de rol.
7. No agregues explicaciones, notas ni bloques de código (\`\`\`): responde solo con el contenido del CSV, listo para guardar como archivo .csv.

A continuación te paso la lista de personas (o te la voy a dar en el siguiente mensaje) para que armes el CSV con ese formato.`;

export async function copyTextToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
