import type { ComponentState, ComponentStats } from "../api/analytics.api";

/** Cómo se leen los estados de un componente (etiqueta + tono del chip). */
export const COMPONENT_STATE_META: Record<
  ComponentState,
  { label: string; chip: string; dot: string }
> = {
  atrasada: {
    label: "Atrasado",
    chip: "bg-brand-red-light text-brand-red-dark dark:bg-brand-red/20 dark:text-brand-red",
    dot: "bg-brand-red",
  },
  en_riesgo: {
    label: "En riesgo",
    chip: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
    dot: "bg-orange-500",
  },
  en_curso: {
    label: "En curso",
    chip: "bg-brand-blue-light text-brand-blue-dark dark:bg-brand-blue/20 dark:text-brand-blue",
    dot: "bg-brand-blue",
  },
  sin_iniciar: {
    label: "Sin iniciar",
    chip: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/50",
  },
  completada: {
    label: "Completado",
    chip: "bg-brand-teal-light text-brand-teal-dark dark:bg-brand-teal/20 dark:text-brand-teal",
    dot: "bg-brand-teal",
  },
  sin_tareas: {
    label: "Sin tareas",
    chip: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/30",
  },
};

/** Orden en que se ofrecen los estados como filtro. */
export const COMPONENT_STATE_ORDER: ComponentState[] = [
  "atrasada",
  "en_riesgo",
  "en_curso",
  "sin_iniciar",
  "completada",
  "sin_tareas",
];

export type ComponentSort = "estructura" | "atraso" | "menor-avance" | "mas-tareas";

export const COMPONENT_SORT_LABELS: Record<ComponentSort, string> = {
  estructura: "Orden de la estructura",
  atraso: "Más atrasados primero",
  "menor-avance": "Menor avance primero",
  "mas-tareas": "Más tareas primero",
};

export interface ComponentCriteria {
  query: string;
  states: ReadonlySet<ComponentState>;
  /** Tipos de elemento (curso, módulo…) por nombre; vacío = todos. */
  tipos: ReadonlySet<string>;
  /** Solo componentes hasta este nivel (0 = raíz); null = todos. */
  maxDepth: number | null;
  hideEmpty: boolean;
}

export const DEFAULT_CRITERIA: ComponentCriteria = {
  query: "",
  states: new Set(),
  tipos: new Set(),
  maxDepth: null,
  hideEmpty: true,
};

/** ¿Hay algún criterio que obligue a una lista plana (sin jerarquía)? Con un
 *  filtro de texto, estado o tipo el padre puede no cumplirlo y el hijo sí, así
 *  que mostrar el árbol dejaría ramas rotas: se enseña cada coincidencia con su
 *  ruta completa. */
export function needsFlatList(c: ComponentCriteria, sort: ComponentSort): boolean {
  return c.query.trim() !== "" || c.states.size > 0 || c.tipos.size > 0 || sort !== "estructura";
}

export function matchesCriteria(row: ComponentStats, c: ComponentCriteria): boolean {
  if (c.hideEmpty && row.total === 0) {
    return false;
  }
  if (c.maxDepth !== null && row.depth > c.maxDepth) {
    return false;
  }
  if (c.states.size > 0 && !c.states.has(row.state)) {
    return false;
  }
  if (c.tipos.size > 0 && !(row.tipo_nombre !== null && c.tipos.has(row.tipo_nombre))) {
    return false;
  }
  const q = c.query.trim().toLowerCase();
  return q === "" || row.path.join(" ").toLowerCase().includes(q);
}

const STATE_RANK: Record<ComponentState, number> = {
  atrasada: 0,
  en_riesgo: 1,
  en_curso: 2,
  sin_iniciar: 3,
  completada: 4,
  sin_tareas: 5,
};

export function sortComponents(rows: ComponentStats[], sort: ComponentSort): ComponentStats[] {
  if (sort === "estructura") {
    return rows;
  }
  const sorted = [...rows];
  switch (sort) {
    case "atraso":
      sorted.sort(
        (a, b) =>
          STATE_RANK[a.state] - STATE_RANK[b.state] ||
          b.overdue - a.overdue ||
          a.progress_pct - b.progress_pct,
      );
      break;
    case "menor-avance":
      sorted.sort((a, b) => a.progress_pct - b.progress_pct || b.total - a.total);
      break;
    case "mas-tareas":
      sorted.sort((a, b) => b.total - a.total);
      break;
  }
  return sorted;
}

/**
 * Filas del árbol visibles dado el conjunto de ramas COLAPSADAS. `rows` viene en
 * orden de árbol, así que basta con saltarse a los descendientes de una rama
 * colapsada (todas las filas siguientes con más profundidad).
 */
export function visibleTree(
  rows: ComponentStats[],
  collapsed: ReadonlySet<string>,
): ComponentStats[] {
  const out: ComponentStats[] = [];
  let hiddenBelow: number | null = null;
  for (const row of rows) {
    if (hiddenBelow !== null) {
      if (row.depth > hiddenBelow) {
        continue;
      }
      hiddenBelow = null;
    }
    out.push(row);
    if (collapsed.has(row.id)) {
      hiddenBelow = row.depth;
    }
  }
  return out;
}

/** Ids de las ramas que conviene dejar plegadas al abrir: con muchos componentes,
 *  todo lo que tenga hijos y esté más hondo que `keepDepth`. */
export function initialCollapsed(rows: ComponentStats[], keepDepth: number): Set<string> {
  return new Set(rows.filter((r) => r.child_count > 0 && r.depth >= keepDepth).map((r) => r.id));
}

export function countByState(rows: ComponentStats[]): Record<ComponentState, number> {
  const counts: Record<ComponentState, number> = {
    atrasada: 0,
    en_riesgo: 0,
    en_curso: 0,
    sin_iniciar: 0,
    completada: 0,
    sin_tareas: 0,
  };
  for (const r of rows) {
    counts[r.state] += 1;
  }
  return counts;
}

export function distinctTipos(rows: ComponentStats[]): string[] {
  return [...new Set(rows.map((r) => r.tipo_nombre).filter((n): n is string => n !== null))].sort(
    (a, b) => a.localeCompare(b),
  );
}
