import type { JwtPayload } from "@/features/auth/types";

export function decodeJwt(token: string): JwtPayload | null {
    try {
        const payload = token.split(".")[1];
        if (!payload) return null;
        const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
        const json = atob(normalized);
        return JSON.parse(json) as JwtPayload;
    } catch {
        return null;
    }
}

export function isTokenExpired(token: string, skewSeconds = 30): boolean {
    const payload = decodeJwt(token);
    if (!payload?.exp) return true;
    const nowSeconds = Math.floor(Date.now() / 1000);
    return payload.exp - skewSeconds <= nowSeconds;
}
