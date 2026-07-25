const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FieldName = "email" | "password";

// ── Validación por campo (pantalla de acceso) ──
export function validateField(name: FieldName, value: string): string | undefined {
  const v = value.trim();
  switch (name) {
    case "email":
      if (!v) {
        return "El correo es obligatorio.";
      }
      if (!EMAIL_RE.test(v)) {
        return "Formato de correo no válido.";
      }
      return;
    case "password":
      if (!v) {
        return "La contraseña es obligatoria.";
      }
      return;
  }
}
