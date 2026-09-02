import http from "@/lib/http";
import type { LoginRequest, LoginResponse } from "@/features/auth/types.ts";
import type { AxiosResponse } from "axios";

export interface ActivationInfo {
  email: string;
  name: string;
}

export const authApi = {
  login: (data: LoginRequest) =>
    http
      .post<LoginResponse>("/identity/auth/login", data)
      .then((r: AxiosResponse<LoginResponse>) => r.data),

  /** Valida el enlace de activación y devuelve a quién pertenece. Sin sesión. */
  activationInfo: (token: string) =>
    http
      .get<ActivationInfo>(`/identity/activation/${encodeURIComponent(token)}`)
      .then((r: AxiosResponse<ActivationInfo>) => r.data),

  /** Consume el token de un solo uso, fija la contraseña y devuelve sesión. */
  activateAccount: (token: string, newPassword: string) =>
    http
      .post<LoginResponse>("/identity/activation/complete", {
        token,
        new_password: newPassword,
      })
      .then((r: AxiosResponse<LoginResponse>) => r.data),

  logout: () => http.post("/identity/auth/logout").then((r) => r.data),

  changePassword: (currentPassword: string, newPassword: string) =>
    http
      .patch("/identity/me/password", {
        current_password: currentPassword,
        new_password: newPassword,
      })
      .then((r) => r.data),
};
