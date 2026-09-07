/** Un trozo de texto ya clasificado para pintarse. */
export type InlineToken =
  | { kind: "text"; value: string }
  /** Etiqueta literal de la interfaz (un botón, una pestaña, un menú). */
  | { kind: "ui"; value: string }
  | { kind: "strong"; value: string };

// `[[Etiqueta]]` y `**énfasis**` en una sola pasada: con dos `replace`
// encadenados una marca podría partir a la otra por la mitad.
const PATTERN = /\[\[([^\]]+)\]\]|\*\*([^*]+)\*\*/g;

/**
 * Parte un texto del manual en tokens. Se escribe en el contenido con dos
 * marcas mínimas —`[[Entregar]]` para lo que se lee literal en la pantalla y
 * `**así**` para el énfasis— en vez de meter Markdown entero: el manual no
 * necesita más y así no entra una dependencia por dos negritas.
 */
export function parseInline(text: string): InlineToken[] {
  const out: InlineToken[] = [];
  let last = 0;
  for (const match of text.matchAll(PATTERN)) {
    const at = match.index;
    if (at > last) {
      out.push({ kind: "text", value: text.slice(last, at) });
    }
    // Cuál de las dos alternativas casó se decide por el delimitador, no por
    // qué grupo quedó definido: el tipado de `match` no distingue grupos
    // opcionales y comprobarlo así evita un `undefined` que TS no ve.
    if (match[0].startsWith("[[")) {
      out.push({ kind: "ui", value: match[1] });
    } else {
      out.push({ kind: "strong", value: match[2] });
    }
    last = at + match[0].length;
  }
  if (last < text.length) {
    out.push({ kind: "text", value: text.slice(last) });
  }
  return out;
}

/** El mismo texto sin marcas: lo que indexa la búsqueda. */
export function plainText(text: string): string {
  return parseInline(text)
    .map((t) => t.value)
    .join("");
}
