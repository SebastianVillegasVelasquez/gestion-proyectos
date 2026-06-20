import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import type { AccentColor, KpiCard } from "../types";

const accentBorderMap: Record<AccentColor, string> = {
  amber: "border-b-amber-400   dark:border-b-amber-500",
  emerald: "border-b-emerald-500 dark:border-b-emerald-500",
  blue: "border-b-brand-teal dark:border-b-brand-teal",
  red: "border-b-red-500     dark:border-b-red-500",
};

function KpiCardItem({ card }: { card: KpiCard }) {
  return (
    <Card
      className={cn(
        "border border-b-2 p-5 transition-colors duration-150",
        "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700",
        accentBorderMap[card.accentColor],
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
        {card.label}
      </p>
      <p className="mt-3 text-[36px] font-bold leading-none tracking-tight text-slate-900 dark:text-slate-50">
        {card.value}
      </p>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{card.subtitle}</p>
    </Card>
  );
}

function KpiCardSkeleton() {
  return (
    <Card className="border border-b-2 border-slate-200 p-5 dark:border-slate-800">
      <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-3 h-9 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
    </Card>
  );
}

interface KpiCardsGridProps {
  cards: KpiCard[];
  isLoading?: boolean;
  isError?: boolean;
}

export function KpiCardsGrid({ cards, isLoading, isError }: KpiCardsGridProps) {
  if (isError) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
      >
        No se pudieron cargar los indicadores. Intenta recargar la página.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <KpiCardItem key={card.id} card={card} />
      ))}
    </div>
  );
}
