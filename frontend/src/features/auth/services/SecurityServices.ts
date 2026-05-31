const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FieldName = "name" | "lastname" | "email" | "password";

// ── Validación por campo ──
export function validateField(name: FieldName, value: string, isRegister: boolean): string | undefined {
    const v = value.trim();
    switch (name) {
        case "name":
            if (isRegister && !v) return "Ingresa tu nombre.";
            return;
        case "lastname":
            if (isRegister && !v) return "Ingresa tu apellido.";
            return;
        case "email":
            if (!v) return "El correo es obligatorio.";
            if (!EMAIL_RE.test(v)) return "Formato de correo no válido.";
            return;
        case "password":
            if (!v) return "La contraseña es obligatoria.";
            if (isRegister && v.length < 8) return "Mínimo 8 caracteres.";
            return;
    }
}

// ── Fuerza de contraseña (0–4) ──
export function passwordStrength(pw: string): {score: number; label: string; color: string} {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const map = [
        {label: "Muy débil", color: "bg-red-500"},
        {label: "Débil", color: "bg-orange-500"},
        {label: "Aceptable", color: "bg-yellow-500"},
        {label: "Fuerte", color: "bg-lime-500"},
        {label: "Excelente", color: "bg-emerald-500"},
    ];
    return {score, ...map[score]};
}
