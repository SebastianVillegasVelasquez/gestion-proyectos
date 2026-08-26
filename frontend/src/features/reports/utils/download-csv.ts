/** Nombre del archivo que propone el servidor en `Content-Disposition`. */
export function filenameFromDisposition(disposition: string | undefined, fallback: string): string {
  if (!disposition) {
    return fallback;
  }
  const match = /filename="?([^";]+)"?/.exec(disposition);
  return match?.[1] ?? fallback;
}

/**
 * Entrega un archivo ya descargado al navegador.
 *
 * El CSV viaja por la API con su token de sesión, así que no se puede abrir con
 * un enlace directo: llega como blob y aquí se convierte en descarga. La URL
 * temporal se revoca porque, si no, el blob se queda en memoria hasta recargar.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
