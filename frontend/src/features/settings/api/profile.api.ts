import http from "@/lib/http";
import type { AuthUser } from "@/features/auth/types";
import { readSession, writeSession } from "@/features/auth/utils/session.utils";
import { USER_REVALIDATED_EVENT } from "@/features/auth/api/revalidate";

/**
 * Deja la sesión local al día con lo que acaba de guardar el servidor.
 *
 * Sin esto, la foto o la presentación recién guardadas no aparecerían en la
 * cabecera ni en el resto de la aplicación hasta la siguiente revalidación
 * (que solo ocurre al enfocar la pestaña).
 */
function applyToSession(user: AuthUser): AuthUser {
  const session = readSession();
  if (session) {
    writeSession({ ...session, user });
    window.dispatchEvent(new Event(USER_REVALIDATED_EVENT));
  }
  return user;
}

export const profileApi = {
  updateBio: (bio: string) =>
    http.patch<AuthUser>("/identity/me/profile", { bio }).then((r) => applyToSession(r.data)),

  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return http
      .post<AuthUser>("/identity/me/avatar", form, {
        timeout: 60_000,
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => applyToSession(r.data));
  },

  deleteAvatar: () =>
    http.delete<AuthUser>("/identity/me/avatar").then((r) => applyToSession(r.data)),
};

/** URL absoluta de una foto de perfil, o null. En la base se guarda relativa. */
export function avatarSrc(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) {
    return null;
  }
  const base = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
  return `${base.replace(/\/$/, "")}${avatarUrl}`;
}
