import { describe, it, expect } from "vitest";
import { filterSections, normalize } from "./search";
import type { ManualSection } from "../types";
import { MANUAL_SECTIONS } from "../manual-content";

const sections: ManualSection[] = [
  {
    id: "s1",
    title: "Sección uno",
    Icon: (() => null) as never,
    articles: [
      {
        id: "a1",
        title: "Entregar una tarea",
        summary: "Las dos formas de entregar.",
        keywords: ["evidencia"],
        blocks: [{ kind: "p", text: "Pulsa [[Entregar sin adjunto]] para cerrarla." }],
      },
      {
        id: "a2",
        title: "Revisión de entregas",
        summary: "Aprobar o devolver.",
        blocks: [{ kind: "list", items: ["Aprobar el trabajo del **equipo**."] }],
      },
    ],
  },
  {
    id: "s2",
    title: "Sección dos",
    Icon: (() => null) as never,
    articles: [
      {
        id: "b1",
        title: "Archivos",
        summary: "El archivador del proyecto.",
        blocks: [{ kind: "p", text: "Sube ficheros a la carpeta de tu equipo." }],
      },
    ],
  },
];

describe("normalize", () => {
  it("quita tildes y pasa a minúsculas", () => {
    expect(normalize("Revisión ÁRBOL")).toBe("revision arbol");
  });
});

describe("filterSections", () => {
  it("sin término devuelve el índice completo", () => {
    expect(filterSections(sections, "   ")).toHaveLength(2);
  });

  it("encuentra por título aunque se escriba sin tildes", () => {
    const found = filterSections(sections, "revision");
    expect(found).toHaveLength(1);
    expect(found[0].articles.map((a) => a.id)).toEqual(["a2"]);
  });

  it("busca dentro del cuerpo del artículo, no solo en el título", () => {
    const found = filterSections(sections, "ficheros");
    expect(found[0].articles.map((a) => a.id)).toEqual(["b1"]);
  });

  it("ignora las marcas de la interfaz al indexar el texto", () => {
    // "[[Entregar sin adjunto]]" debe encontrarse por su texto plano.
    const found = filterSections(sections, "sin adjunto");
    expect(found[0].articles.map((a) => a.id)).toEqual(["a1"]);
  });

  it("exige TODAS las palabras: dos términos acotan, no amplían", () => {
    // "entrega" casa con «Entregar una tarea» y «Revisión de entregas»; añadir
    // "evidencia" (una keyword de la primera) deja solo esa.
    expect(filterSections(sections, "entrega").flatMap((s) => s.articles)).toHaveLength(2);
    const narrowed = filterSections(sections, "entrega evidencia");
    expect(narrowed.flatMap((s) => s.articles).map((a) => a.id)).toEqual(["a1"]);
  });

  it("descarta las secciones que se quedan sin artículos", () => {
    expect(filterSections(sections, "archivador").map((s) => s.id)).toEqual(["s2"]);
  });

  it("un término inexistente devuelve un índice vacío", () => {
    expect(filterSections(sections, "xyzzy")).toEqual([]);
  });
});

describe("contenido del manual", () => {
  it("no repite ids de artículo (la URL ?tema= los usa como clave)", () => {
    const ids = MANUAL_SECTIONS.flatMap((s) => s.articles.map((a) => a.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cada artículo tiene resumen y al menos un bloque", () => {
    for (const section of MANUAL_SECTIONS) {
      for (const article of section.articles) {
        expect(article.summary.length).toBeGreaterThan(0);
        expect(article.blocks.length).toBeGreaterThan(0);
      }
    }
  });
});
