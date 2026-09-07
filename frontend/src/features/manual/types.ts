import type { LucideIcon } from "lucide-react";

/** Tono de un aviso dentro de un artículo. */
export type NoteTone = "tip" | "warn" | "info";

/**
 * A quién le concierne un tema. Sin marca = a todo el mundo. La marca no
 * oculta nada: el manual se lee entero si se quiere, pero al buscar dice de un
 * vistazo si lo que encontraste es de tu rol o del otro.
 */
export type ManualAudience = "integrante" | "lider";

/**
 * Un trozo de artículo. El manual es CONTENIDO, no maquetación: cada bloque
 * dice qué es (un párrafo, unos pasos, un aviso…) y el renderizador decide
 * cómo se ve. Así añadir un tema es escribir texto, no JSX.
 *
 * En los textos se admiten dos marcas en línea:
 *   `[[Entregar]]`  → una etiqueta de la interfaz (botón, pestaña, menú)
 *   `**importante**` → énfasis
 */
export type ManualBlock =
  | { kind: "p"; text: string }
  /** Pasos numerados: la secuencia exacta que hay que seguir. */
  | { kind: "steps"; items: string[] }
  | { kind: "list"; items: string[] }
  | { kind: "note"; tone: NoteTone; title?: string; text: string }
  /** Leyenda de estados: la pastilla tal cual se ve en la app + qué significa. */
  | { kind: "legend"; items: { label: string; desc: string; chip: string }[] }
  | { kind: "table"; head: string[]; rows: string[][] }
  /**
   * Video incrustado. `src` a `null` significa «todavía no se ha grabado»: se
   * pinta un aviso en su lugar en vez de un reproductor roto, para que el
   * apartado pueda existir en el manual antes que el video.
   */
  | { kind: "video"; src: string | null; caption: string };

export interface ManualArticle {
  id: string;
  title: string;
  /** Una línea que responde «¿de qué trata?»: se ve en el índice y al buscar. */
  summary: string;
  audience?: ManualAudience;
  /** Términos que la búsqueda debe encontrar aunque no salgan en el texto. */
  keywords?: string[];
  blocks: ManualBlock[];
}

export interface ManualSection {
  id: string;
  title: string;
  Icon: LucideIcon;
  /** Una línea bajo el título de la sección en el índice. */
  hint?: string;
  articles: ManualArticle[];
}
