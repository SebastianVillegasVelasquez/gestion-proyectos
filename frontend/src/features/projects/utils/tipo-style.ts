// Paleta determinista para los tipos de nodo. Si el TipoNodo trae `color`
// propio se respeta; si no, se asigna un color estable a partir de su id para
// que el mismo tipo se vea siempre igual en el árbol.

export interface TipoStyle {
  dot: string;
  chip: string;
  bar: string;
  /** Color sólido de la barra en HEX: para exportar a HTML/imagen, donde las
   * clases de Tailwind no existen. Espeja exactamente a `bar`. */
  barHex: string;
}

const PALETTE: TipoStyle[] = [
  {
    dot: "bg-blue-500",
    chip: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    bar: "bg-blue-500",
    barHex: "#3b82f6",
  },
  {
    dot: "bg-violet-500",
    chip: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
    bar: "bg-violet-500",
    barHex: "#8b5cf6",
  },
  {
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    bar: "bg-emerald-500",
    barHex: "#10b981",
  },
  {
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    bar: "bg-amber-500",
    barHex: "#f59e0b",
  },
  {
    dot: "bg-rose-500",
    chip: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    bar: "bg-rose-500",
    barHex: "#f43f5e",
  },
  {
    dot: "bg-cyan-500",
    chip: "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
    bar: "bg-cyan-500",
    barHex: "#06b6d4",
  },
];

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Nombre del tipo reservado para trabajo de terceros (lo crea un botón en la
 * Estructura). Siempre se pinta naranja para que salte a la vista de que ese
 * tramo no lo maneja el equipo. */
export const THIRD_PARTY_TIPO_NOMBRE = "Actividad de terceros";

const THIRD_PARTY_STYLE: TipoStyle = {
  dot: "bg-orange-500",
  chip: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  bar: "bg-orange-500",
  barHex: "#f97316",
};

export function tipoStyle(
  tipoId: string,
  nombre?: string | null,
  esDependenciaExterna?: boolean,
): TipoStyle {
  // El flag del tipo manda; el nombre queda como respaldo para tipos antiguos.
  if (
    esDependenciaExterna ||
    nombre?.trim().toLowerCase() === THIRD_PARTY_TIPO_NOMBRE.toLowerCase()
  ) {
    return THIRD_PARTY_STYLE;
  }
  return PALETTE[hash(tipoId) % PALETTE.length];
}
