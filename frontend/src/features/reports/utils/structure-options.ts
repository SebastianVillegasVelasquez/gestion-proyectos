import type { WorkItemTree } from "@/features/projects/types/api.types";

export interface StructureOption {
  id: string;
  name: string;
  /** Ruta raíz → elemento, él incluido. */
  path: string[];
  depth: number;
}

/** Todos los elementos del árbol (hojas incluidas) en orden de árbol, con su
 *  ruta: lo que necesita un selector con búsqueda para elegir una rama. */
export function flattenStructure(
  nodes: WorkItemTree[],
  parentPath: string[] = [],
): StructureOption[] {
  return nodes.flatMap((node) => {
    const path = [...parentPath, node.nombre];
    return [
      { id: node.id, name: node.nombre, path, depth: parentPath.length },
      ...flattenStructure(node.children, path),
    ];
  });
}

/** Coincidencias de `query` contra la ruta completa (sin distinguir mayúsculas
 *  ni tildes: quien busca «modulo» espera ver «Módulo»). Sin texto devuelve
 *  todo. Cada palabra debe aparecer, en cualquier orden. */
export function filterStructure(options: StructureOption[], query: string): StructureOption[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return options;
  }
  return options.filter((o) => {
    const haystack = normalize(o.path.join(" "));
    return words.every((w) => haystack.includes(w));
  });
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}
