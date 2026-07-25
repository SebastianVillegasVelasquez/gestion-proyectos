import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { positionsApi } from "../api/positions.api";

const positionsKey = ["positions"] as const;

/**
 * Cargos disponibles (tabla mutable `positions` en el backend). `enabled`
 * permite cargarlos de forma perezosa (p. ej. solo cuando se abre un modal).
 */
export function usePositions(enabled = true) {
  return useQuery({
    queryKey: positionsKey,
    queryFn: () => positionsApi.list(),
    staleTime: 1000 * 60 * 60, // 1h: el catálogo de cargos cambia muy poco
    enabled,
  });
}

/** Alta de un cargo nuevo (admin/super_admin/developer): queda disponible de inmediato. */
export function useCreatePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: positionsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: positionsKey }),
  });
}
