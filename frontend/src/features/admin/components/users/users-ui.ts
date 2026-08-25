import { Role } from "@/features/auth/types";

// Piezas de presentación compartidas por la página de usuarios y sus modales.
// Viven aparte para que un cambio de estilo o de etiqueta no obligue a tocar
// cinco archivos (ni a que uno importe de otro solo por una constante).

// Roles que un admin puede asignar desde la UI. Un super_admin (o developer)
// puede además ascender a alguien a super_admin; un admin normal no.
export function getAssignableRoles(actorRole: Role): { value: Role; label: string }[] {
  const base: { value: Role; label: string }[] = [
    { value: Role.USER, label: "Usuario" },
    { value: Role.ADMIN, label: "Administrador" },
  ];
  if (actorRole === Role.SUPER_ADMIN || actorRole === Role.DEVELOPER) {
    base.push({ value: Role.SUPER_ADMIN, label: "Super admin" });
  }
  return base;
}

export const ROLE_LABEL: Record<string, string> = {
  developer: "Developer",
  super_admin: "Super admin",
  admin: "Administrador",
  user: "Usuario",
};

export const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";
