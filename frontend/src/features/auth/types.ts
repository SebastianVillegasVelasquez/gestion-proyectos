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

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: AuthUser;
}

export const Role = {
  DEVELOPER: "developer",
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  USER: "user",
  CLIENT: "client",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export interface JwtPayload {
  sub: string;
  role?: Role;
  exp: number;
  iat?: number;
}
