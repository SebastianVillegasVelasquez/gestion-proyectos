import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { authService } from "@/features/auth/services/auth-service";
import { type LoginRequest, type RegisterRequest } from "@/features/auth/types";
import { getErrorMessage } from "@/utils/get-error-message";

export function useLogin() {
    const navigate = useNavigate();

    return useMutation({
        mutationFn: (data: LoginRequest) => authService.login(data),
        onSuccess: (res) => {
            localStorage.setItem("access_token", res.access_token);
            navigate("/dashboard");
        },
        onError: (error) => {
            console.error(getErrorMessage(error, "Error al iniciar sesión"));
        },
    });
}

export function useRegister() {
    const navigate = useNavigate();

    return useMutation({
        mutationFn: (data: RegisterRequest) => authService.register(data),
        onSuccess: (res) => {
            localStorage.setItem("access_token", res.access_token);
            navigate("/dashboard");
        },
        onError: (error) => {
            console.error(getErrorMessage(error, "Error al registrarse"));
        },
    });
}