import { useMemo, useState } from "react";

export type SortDirection = "asc" | "desc";

export interface SortState<K extends string> {
  key: K | null;
  direction: SortDirection;
}

/**
 * Ordena un array en cliente al hacer clic en un header de columna, sin mutar
 * el array original. `getValue` extrae el valor comparable (string/number/null)
 * para una clave de columna dada — solo esas columnas son ordenables.
 * Pensado para tablas planas (sin jerarquía) que ya trajeron todos sus datos:
 * si la tabla pagina en el servidor, el sort debe ir en el backend, no aquí.
 */
export function useSortableData<T, K extends string>(
  items: T[],
  getValue: (item: T, key: K) => string | number | null,
) {
  const [sort, setSort] = useState<SortState<K>>({ key: null, direction: "asc" });

  const sorted = useMemo(() => {
    if (!sort.key) {
      return items;
    }
    const key = sort.key;
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      const av = getValue(a, key);
      const bv = getValue(b, key);
      if (av == null && bv == null) {
        return 0;
      }
      // Los valores ausentes (sin fecha, sin prioridad…) quedan al final,
      // sin importar la dirección — no tiene sentido que "ninguno" sea "el mayor".
      if (av == null) {
        return 1;
      }
      if (bv == null) {
        return -1;
      }
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv), "es", { sensitivity: "base" }) * dir;
    });
  }, [items, sort, getValue]);

  const toggleSort = (key: K) => {
    setSort((prev) => {
      if (prev.key !== key) {
        return { key, direction: "asc" };
      }
      return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
    });
  };

  return { sorted, sort, toggleSort };
}
