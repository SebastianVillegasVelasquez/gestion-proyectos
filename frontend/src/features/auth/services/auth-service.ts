import http from "./http";
import type {LoginRequest, LoginResponse, RegisterRequest} from "@/features/auth/types.ts";
import type {AxiosResponse} from "axios";


export const authService = {
    login: (data: LoginRequest) =>
        http.post<LoginResponse>("/identity/auth/login", data).then((r: AxiosResponse<LoginResponse>) => r.data),

    register: (data: RegisterRequest) =>
        http.post<LoginResponse>("/identity", data).then((r: AxiosResponse<LoginResponse>) => r.data),

    logout: () =>
        http.post("/identity/auth/logout").then((r) => r.data),
};