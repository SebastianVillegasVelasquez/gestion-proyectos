import { useMemo, useState } from "react";

export interface ClientPagination<T> {
  /** Página actual (1-based), ya recortada al rango válido. */
  page: number;
  totalPages: number;
  /** Elementos de la página actual. */
  pageItems: T[];
  /** Total de elementos (tras filtrar, antes de paginar). */
  total: number;
  setPage: (page: number) => void;
  next: () => void;
  prev: () => void;
}

/**
 * Paginación en cliente para listas ya cargadas enteras. La consulta sigue
 * trayendo todo (otras vistas necesitan el total), pero la lista solo pinta una
 * página. Mismo enfoque que la tabla de tareas del proyecto.
 *
 * `items` debe venir ya filtrado: al encoger la lista, la página se recorta
 * sola al último rango con contenido (no te deja "atrapado" en una página vacía).
 */
export function useClientPagination<T>(items: T[], pageSize: number): ClientPagination<T> {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pageItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize],
  );

  return {
    page: safePage,
    totalPages,
    pageItems,
    total: items.length,
    setPage,
    // Actualizador funcional + recorte: varias llamadas seguidas en el mismo
    // tick se acumulan bien y nunca se salen del rango.
    next: () => {
      setPage((p) => Math.min(p + 1, totalPages));
    },
    prev: () => {
      setPage((p) => Math.max(1, p - 1));
    },
  };
}
