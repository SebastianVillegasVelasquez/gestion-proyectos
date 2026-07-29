// Paleta determinista por nombre: la misma entidad (equipo, tarea delegada a un
// equipo, etc.) se ve siempre con el mismo acento sin importar la pantalla
// desde la que se consulte, sin necesitar un campo de color en el backend.
const PALETTE = [
  "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300",
  "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
  "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-300",
  "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300",
];

export function colorForName(name: string): string {
  let hash = 0;
  for (const ch of name) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
