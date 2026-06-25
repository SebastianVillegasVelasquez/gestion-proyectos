import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/features/auth/api/auth.api.ts";

/**
 * Carga los cargos disponibles desde el backend (GET /identity/positions).
 * Único origen de verdad: si los cargos migran a una tabla, este hook no cambia.
 *
 * `enabled` permite cargar los cargos de forma perezosa: en el login no se
 * piden hasta que el usuario abre el registro (es el único lugar que los usa).
 */
export function usePositions(enabled = true) {
  return useQuery({
    queryKey: ["positions"],
    queryFn: () => authApi.positions(),
    staleTime: 1000 * 60 * 60, // 1h: el catálogo de cargos cambia muy poco
    enabled,
  });
}
