import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { whatsNewApi } from "./api";

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
    onSuccess: (data) => {
      qc.setQueryData(seenKey, data);
    },
  });
}
