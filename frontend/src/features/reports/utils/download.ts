/** Guarda un Blob como archivo, disparando la descarga del navegador. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Extrae `filename="…"` de una cabecera Content-Disposition. */
export function filenameFromDisposition(disposition: string | undefined, fallback: string): string {
  const match = /filename="?([^"';]+)"?/i.exec(disposition ?? "");
  const name = match?.[1]?.trim();
  return name && name.length > 0 ? name : fallback;
}
