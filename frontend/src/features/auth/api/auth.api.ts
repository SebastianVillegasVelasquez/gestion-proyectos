import http from "@/lib/http";
import type {
  LoginRequest,
  LoginResponse,
  PositionOption,
  RegisterRequest,
} from "@/features/auth/types.ts";
import type { AxiosResponse } from "axios";

export const authApi = {
  login: (data: LoginRequest) =>
    http
      .post<LoginResponse>("/identity/auth/login", data)
      .then((r: AxiosResponse<LoginResponse>) => r.data),

  register: (data: RegisterRequest) =>
    http.post<LoginResponse>("/identity", data).then((r: AxiosResponse<LoginResponse>) => r.data),

  logout: () => http.post("/identity/auth/logout").then((r) => r.data),

  positions: () =>
    http
      .get<PositionOption[]>("/identity/positions")
      .then((r: AxiosResponse<PositionOption[]>) => r.data),
};
