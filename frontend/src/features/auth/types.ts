export interface LoginRequest{
    email: string;
    password: string;
}

export interface LoginResponse {
    token: string;
}

export interface RegisterRequest{
    name: string;
    last_name: string;
    email: string;
    password: string;
    role: typeof Role.COLLABORATOR
}

export const Role = {
    SUPER_ADMIN: "super_admin",
    ADMIN: "admin",
    COORDINATOR: "coordinator",
    COLLABORATOR: "collaborator",
    MEMBER: "member",
    CLIENT: "client",
} as const;

export type Role = typeof Role[keyof typeof Role];
