import { plainText } from "./inline";
import type { ManualArticle, ManualBlock, ManualSection } from "../types";

/** Todo el texto buscable de un bloque, ya sin marcas. */
function blockText(block: ManualBlock): string {
  switch (block.kind) {
    case "p":
      return plainText(block.text);
    case "steps":
    case "list":
      return block.items.map(plainText).join(" ");
    case "note":
      return `${block.title ?? ""} ${plainText(block.text)}`;
    case "legend":
      return block.items.map((i) => `${i.label} ${plainText(i.desc)}`).join(" ");
    case "table":
      return [...block.head, ...block.rows.flat().map(plainText)].join(" ");
  }
}

// Marcas diacríticas que `normalize("NFD")` separa de su letra base. Se quitan
// para que escribir "revision" encuentre "revisión": nadie escribe tildes en un
// buscador.
const DIACRITICS = /[̀-ͯ]/g;

/** Minúsculas y sin tildes. */
export function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(DIACRITICS, "");
}

/** Índice de búsqueda de un artículo, calculado una sola vez por consulta. */
function haystack(article: ManualArticle): string {
  return normalize(
    [
      article.title,
      article.summary,
      ...(article.keywords ?? []),
      ...article.blocks.map(blockText),
    ].join(" "),
  );
}

/**
 * Filtra el índice por texto libre. Se exige que TODAS las palabras del término
 * aparezcan (no una cualquiera): con dos palabras la persona está acotando, no
 * ampliando. Las secciones que se quedan sin artículos desaparecen.
 */
export function filterSections(sections: ManualSection[], term: string): ManualSection[] {
  const words = normalize(term.trim()).split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return sections;
  }
  return sections
    .map((section) => ({
      ...section,
      articles: section.articles.filter((article) => {
        const text = haystack(article);
        return words.every((word) => text.includes(word));
      }),
    }))
    .filter((section) => section.articles.length > 0);
}
