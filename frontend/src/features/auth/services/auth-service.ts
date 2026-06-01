import http from "./http";
import {type LoginRequest, type RegisterRequest, Role} from "@/features/auth/types.ts";
import type {AxiosResponse} from "axios";

export interface AuthResponse {
    access_token: string;
    token_type: string;
    user: {
        id: string;
        name: string;
        email: string;
        role: Role;
    };
}

export const authService = {
    login: (data: LoginRequest) =>
        http.post<AuthResponse>("/identity/auth/login", data).then((r:AxiosResponse<AuthResponse>) => r.data),

    register: (data: RegisterRequest) =>
        http.post<AuthResponse>("/identity", data).then((r:AxiosResponse<AuthResponse>) => r.data),

    logout: () =>
        http.post("/identity/auth/logout").then((r) => r.data),
};