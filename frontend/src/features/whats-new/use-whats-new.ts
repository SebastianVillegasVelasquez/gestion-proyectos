import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { whatsNewApi, type SeenReleasesResponse } from "./api";

const seenKey = ["whats-new", "seen"] as const;

/** Ids de novedades que la persona ya vio (persistido en backend). */
export function useSeenReleases(enabled: boolean) {
  return useQuery({
    queryKey: seenKey,
    queryFn: whatsNewApi.getSeen,
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** Marca novedades como vistas y refresca el set (para que el badge baje a 0). */
export function useMarkReleasesSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (releaseIds: string[]) => whatsNewApi.markSeen(releaseIds),
    // Optimista: dejamos el set "vistas" al día en la caché ANTES de que responda
    // el POST. Así, si el provider se re-monta mientras la petición está en vuelo
    // (o si falla), el modal ya no se considera pendiente y no reaparece. El
    // endpoint es idempotente sobre este conjunto.
    onMutate: (releaseIds) => {
      qc.setQueryData<SeenReleasesResponse>(seenKey, (prev) => ({
        release_ids: [...new Set([...(prev?.release_ids ?? []), ...releaseIds])],
      }));
    },
    onSuccess: (data) => {
      qc.setQueryData(seenKey, data);
    },
  });
}
