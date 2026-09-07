import type { LucideIcon } from "lucide-react";

/** Tono de un aviso dentro de un artículo. */
export type NoteTone = "tip" | "warn" | "info";

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
  | { kind: "table"; head: string[]; rows: string[][] };

export interface ManualArticle {
  id: string;
  title: string;
  /** Una línea que responde «¿de qué trata?»: se ve en el índice y al buscar. */
  summary: string;
  /** Marca lo que solo aplica a quien lidera o supervisa un equipo. */
  audience?: "lider";
  /** Términos que la búsqueda debe encontrar aunque no salgan en el texto. */
  keywords?: string[];
  blocks: ManualBlock[];
}

export interface ManualSection {
  id: string;
  title: string;
  Icon: LucideIcon;
  articles: ManualArticle[];
}
