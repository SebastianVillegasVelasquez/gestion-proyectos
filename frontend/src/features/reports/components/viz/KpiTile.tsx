import { cn } from "@/lib/utils";

export type KpiTone = "bad" | "warn" | "good";

const TONE: Record<KpiTone, string> = {
  bad: "text-brand-red-dark dark:text-brand-red",
  warn: "text-orange-600 dark:text-orange-400",
  good: "text-brand-teal-dark dark:text-brand-teal",
};

/** Cifra grande con su etiqueta: las tarjetas de arriba del informe. */
export function KpiTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: KpiTone;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-4xl font-bold tabular-nums tracking-tight text-foreground",
          tone && TONE[tone],
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[13px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
