// Identidad visual estable para proyectos y equipos: siglas + color. Con varios
// proyectos y equipos que se llaman parecido, el nombre solo no basta para
// reconocer «de cuál es esto»; un chip de color que siempre es el mismo sí.
// Determinista a partir del id (o, si no hay, del nombre): sin campo en el
// backend y sin que cambie entre pantallas.

const SMALL_WORDS = new Set(["de", "del", "la", "las", "el", "los", "y", "e", "para", "por", "en"]);

/** «Proyecto PCTUR / FONTUR» -> «PP»; «Tutor de turismo» -> «TT». Dos letras. */
export function entityInitials(name: string): string {
  const words = name
    .split(/[\s/\-–·]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && !SMALL_WORDS.has(w.toLowerCase()));
  if (words.length === 0) {
    return name.slice(0, 2).toUpperCase() || "?";
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

export interface EntityIdentity {
  /** Fondo sólido del chip de siglas. */
  solid: string;
  /** Versión suave (fondo + texto) para etiquetas junto a un nombre. */
  soft: string;
}

const IDENTITIES: EntityIdentity[] = [
  {
    solid: "bg-blue-600 text-white",
    soft: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  },
  {
    solid: "bg-emerald-600 text-white",
    soft: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  {
    solid: "bg-violet-600 text-white",
    soft: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  {
    solid: "bg-amber-600 text-white",
    soft: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  {
    solid: "bg-rose-600 text-white",
    soft: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  },
  {
    solid: "bg-cyan-600 text-white",
    soft: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
  },
  {
    solid: "bg-fuchsia-600 text-white",
    soft: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300",
  },
  {
    solid: "bg-lime-600 text-white",
    soft: "bg-lime-50 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300",
  },
];

export function identityFor(key: string): EntityIdentity {
  let hash = 0;
  for (const ch of key) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return IDENTITIES[hash % IDENTITIES.length];
}
