/**
 * Color de la barra de avance de un área según su porcentaje. Pura: mismo
 * número → mismas clases (rojo en riesgo, ámbar en marcha, verde al día).
 */
export function areaTone(pct: number): { bar: string; text: string } {
  if (pct < 34) {
    return { bar: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" };
  }
  if (pct < 67) {
    return { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" };
  }
  return { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" };
}
