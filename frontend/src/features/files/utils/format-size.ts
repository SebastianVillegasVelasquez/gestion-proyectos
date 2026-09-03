const UNITS = ["B", "KB", "MB", "GB"] as const;

/** Tamaño legible: 0 B, 812 B, 1.4 MB. Sin decimales para bytes enteros. */
export function formatFileSize(bytes: number): string {
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 ? String(Math.round(value)) : value.toFixed(1);
  return `${rounded} ${UNITS[unit]}`;
}
