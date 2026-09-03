/** Cómo puede el navegador mostrar un archivo, a partir de su tipo MIME. */
export type PreviewKind = "image" | "pdf" | "text" | "video" | "audio" | "unsupported";

const TEXT_TYPES = new Set([
  "application/json",
  "application/xml",
  "application/javascript",
  "application/x-yaml",
]);

/**
 * Ningún navegador pinta un .docx o un .xlsx: el visor lo reconoce y ofrece la
 * descarga en vez de un marco en blanco, que es peor que no abrir nada. Se
 * decide por tipo MIME —lo que el servidor guardó al subirlo— y no por la
 * extensión del nombre, que cualquiera puede cambiar.
 */
export function previewKind(contentType: string | undefined): PreviewKind {
  const type = (contentType ?? "").toLowerCase();
  if (type.startsWith("image/")) {
    return "image";
  }
  if (type === "application/pdf") {
    return "pdf";
  }
  if (type.startsWith("video/")) {
    return "video";
  }
  if (type.startsWith("audio/")) {
    return "audio";
  }
  if (type.startsWith("text/") || TEXT_TYPES.has(type)) {
    return "text";
  }
  return "unsupported";
}
