/** Tramos de color para los DÍAS ESTIMADOS de una tarea: de un vistazo dice si
 * el trabajo es corto o largo. El estimado es con lo que se calcula la fecha de
 * fin cuando una dependencia se resuelve (entrega + días estimados). */
export const DURATION_BUCKETS = [
  {
    max: 2,
    label: "muy corta",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  {
    max: 5,
    label: "corta",
    cls: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  },
  {
    max: 10,
    label: "media",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  {
    max: 20,
    label: "larga",
    cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  },
  {
    max: Infinity,
    label: "muy larga",
    cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  },
] as const;

export function durationBucket(days: number) {
  return (
    DURATION_BUCKETS.find((b) => days <= b.max) ?? DURATION_BUCKETS[DURATION_BUCKETS.length - 1]
  );
}

export function fmtDays(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}
