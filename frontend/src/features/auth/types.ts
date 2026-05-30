export interface LoginRequest{
    email: string;
    password: string;
}

export interface LoginResponse {
    token: string;
}

export interface Register{
    name: string;
    lastname: string;
    email: string;
    password: string;
}

export const ROLES = {
    SUPER_ADMIN : "super_admin",
    ADMIN : "admin",
    COORDINATOR : "coordinator",
    COLLABORATOR : "collaborator",
    MEMBER : "member",
    CLIENT : "client"
}
