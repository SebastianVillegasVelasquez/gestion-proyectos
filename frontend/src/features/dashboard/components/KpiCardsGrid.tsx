import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import type { AccentColor, KpiCard } from "../types";

const accentBorderMap: Record<AccentColor, string> = {
  amber:   "border-b-amber-400   dark:border-b-amber-500",
  emerald: "border-b-emerald-500 dark:border-b-emerald-500",
  blue:    "border-b-blue-500    dark:border-b-blue-500",
  red:     "border-b-red-500     dark:border-b-red-500",
};

function KpiCardItem({ card }: { card: KpiCard }) {
  return (
    <Card
      className={cn(
        "border border-b-2 p-5 transition-colors duration-150",
        "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700",
        accentBorderMap[card.accentColor]
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

interface KpiCardsGridProps {
  cards: KpiCard[];
}

export function KpiCardsGrid({ cards }: KpiCardsGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <KpiCardItem key={card.id} card={card} />
      ))}
    </div>
  );
}
