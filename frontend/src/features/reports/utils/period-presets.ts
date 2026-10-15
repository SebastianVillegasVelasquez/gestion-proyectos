export interface Period {
  from: string;
  to: string;
}

export interface PeriodPreset {
  key: string;
  label: string;
  range: (today: Date) => Period;
}

/** «YYYY-MM-DD» en hora LOCAL: `toISOString` pasa por UTC y, de noche, devolvería
 *  el día siguiente. */
export function toIsoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${String(d.getFullYear())}-${mm}-${dd}`;
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Atajos de periodo. Como el filtro actúa sobre la fecha límite de las tareas,
 *  «próximos 30 días» es tan útil como «últimos 30». */
export const PERIOD_PRESETS: PeriodPreset[] = [
  {
    key: "mes",
    label: "Este mes",
    range: (t) => ({
      from: toIsoDate(new Date(t.getFullYear(), t.getMonth(), 1)),
      to: toIsoDate(new Date(t.getFullYear(), t.getMonth() + 1, 0)),
    }),
  },
  {
    key: "mes-pasado",
    label: "Mes pasado",
    range: (t) => ({
      from: toIsoDate(new Date(t.getFullYear(), t.getMonth() - 1, 1)),
      to: toIsoDate(new Date(t.getFullYear(), t.getMonth(), 0)),
    }),
  },
  {
    key: "ultimos-30",
    label: "Últimos 30 días",
    range: (t) => ({ from: toIsoDate(addDays(t, -29)), to: toIsoDate(t) }),
  },
  {
    key: "proximos-30",
    label: "Próximos 30 días",
    range: (t) => ({ from: toIsoDate(t), to: toIsoDate(addDays(t, 29)) }),
  },
  {
    key: "trimestre",
    label: "Este trimestre",
    range: (t) => {
      const q = Math.floor(t.getMonth() / 3) * 3;
      return {
        from: toIsoDate(new Date(t.getFullYear(), q, 1)),
        to: toIsoDate(new Date(t.getFullYear(), q + 3, 0)),
      };
    },
  },
];

/** El atajo que describe exactamente el rango dado, o null si es uno a mano. */
export function activePreset(
  from: string | undefined,
  to: string | undefined,
  today: Date,
): string | null {
  if (!from || !to) {
    return null;
  }
  return (
    PERIOD_PRESETS.find((p) => {
      const r = p.range(today);
      return r.from === from && r.to === to;
    })?.key ?? null
  );
}
