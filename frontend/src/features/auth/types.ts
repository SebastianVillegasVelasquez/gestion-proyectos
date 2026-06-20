export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  position?: string;
}

/** Opción de cargo servida por GET /identity/positions (fuente de verdad: backend). */
export interface PositionOption {
  value: string;
  label: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: AuthUser;
}

export interface RegisterRequest {
  name: string;
  last_name: string;
  email: string;
  password: string;
  role: typeof Role.USER;
  /** Valor del cargo (UserPosition del backend), p. ej. "sin_cargo". */
  position: string;
}

export const Role = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  USER: "user",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export interface JwtPayload {
  sub: string;
  role?: Role;
  exp: number;
  iat?: number;
}
