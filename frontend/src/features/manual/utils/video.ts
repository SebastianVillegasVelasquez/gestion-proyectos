/** Cómo hay que pintar el video del manual. */
export type VideoSource =
  | { kind: "none" }
  /** Se incrusta en un `iframe` (YouTube, Vimeo). */
  | { kind: "embed"; url: string }
  /** Se reproduce con el `<video>` del navegador (un .mp4 alojado por nosotros). */
  | { kind: "file"; url: string };

const YOUTUBE_ID =
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/;
const VIMEO_ID = /vimeo\.com\/(?:video\/)?(\d+)/;

/**
 * Decide cómo mostrar la URL del video. Se resuelve aquí, y no en el
 * componente, porque quien publique el video va a pegar la URL que le dé el
 * navegador (la de «ver», no la de incrustar) y la pantalla tiene que
 * funcionar igual.
 */
export function resolveVideo(src: string | null | undefined): VideoSource {
  const url = src?.trim();
  if (!url) {
    return { kind: "none" };
  }

  const youtube = YOUTUBE_ID.exec(url);
  if (youtube) {
    return { kind: "embed", url: `https://www.youtube.com/embed/${youtube[1]}` };
  }

  const vimeo = VIMEO_ID.exec(url);
  if (vimeo) {
    return { kind: "embed", url: `https://player.vimeo.com/video/${vimeo[1]}` };
  }

  // Cualquier otra cosa se trata como fichero servido por nosotros. Se exige
  // http(s) para no dejar que un `javascript:` acabe en un `src`.
  if (/^https?:\/\//i.test(url)) {
    return { kind: "file", url };
  }
  return { kind: "none" };
}
