import http from "@/lib/http";

interface SeenReleasesResponse {
  release_ids: string[];
}

// Persistencia por PERSONA (no por dispositivo) de las novedades vistas.
export const whatsNewApi = {
  getSeen: () => http.get<SeenReleasesResponse>("/identity/me/seen-releases").then((r) => r.data),

  markSeen: (releaseIds: string[]) =>
    http
      .post<SeenReleasesResponse>("/identity/me/seen-releases", {
        release_ids: releaseIds,
      })
      .then((r) => r.data),
};
