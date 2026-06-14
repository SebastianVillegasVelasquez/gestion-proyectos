export function getErrorMessage(error: unknown, fallback: string): string {
    const detail = (error as any)?.response?.data?.detail;
    if (!detail) {return fallback;}
    if (typeof detail === "string") {return detail;}
    if (Array.isArray(detail)) {return detail.map((d) => d.msg).join(", ");}
    return fallback;
}