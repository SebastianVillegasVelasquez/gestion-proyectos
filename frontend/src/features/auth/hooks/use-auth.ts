import { useContext } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "@/features/auth/context/AuthContext";
import { authApi } from "@/features/auth/api/auth.api.ts";
import type { LoginRequest, RegisterRequest } from "@/features/auth/types";
import { getErrorMessage } from "@/utils/get-error-message";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  }
  return ctx;
}

export function useLogin(redirectTo = "/dashboard") {
  const navigate = useNavigate();
  const { login } = useAuth();

  return useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data),
    onSuccess: async (res) => {
      login({
        accessToken: res.access_token,
        refreshToken: res.refresh_token,
        user: res.user,
      });
      await navigate(redirectTo, { replace: true });
    },
    onError: (error) => {
      console.error(getErrorMessage(error, "Error al iniciar sesión"));
    },
  });
}

export function useRegister(redirectTo = "/dashboard") {
  const navigate = useNavigate();
  const { login } = useAuth();

  return useMutation({
    mutationFn: (data: RegisterRequest) => authApi.register(data),
    onSuccess: async (res) => {
      login({
        accessToken: res.access_token,
        refreshToken: res.refresh_token,
        user: res.user,
      });
      await navigate(redirectTo, { replace: true });
    },
    onError: (error) => {
      console.error(getErrorMessage(error, "Error al registrarse"));
    },
  });
}

export function useLogout() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: async () => {
      logout();
      await navigate("/login", { replace: true });
    },
  });
}
