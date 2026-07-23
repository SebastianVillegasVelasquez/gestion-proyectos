import { useNavigate } from "react-router";
import { GanttChartSquare, ListChecks, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

function ActionCard({
  title,
  subtitle,
  icon,
  accent,
  onClick,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: "gold" | "teal";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-1 items-center justify-between gap-4 rounded-2xl border bg-card px-6 py-5 text-left transition-all",
        "border-border hover:shadow-lg",
        accent === "gold" ? "hover:border-brand-gold/50" : "hover:border-brand-teal/50",
      )}
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            accent === "gold"
              ? "bg-brand-gold/15 text-brand-gold-dark dark:text-brand-gold"
              : "bg-brand-teal/15 text-brand-teal-dark dark:text-brand-teal",
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-base font-bold text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-muted-foreground transition-colors",
          accent === "gold"
            ? "group-hover:bg-brand-gold group-hover:text-brand-black"
            : "group-hover:bg-brand-teal group-hover:text-white",
        )}
      >
        <ArrowRight className="size-4" />
      </div>
    </button>
  );
}

export function ProjectActions({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  return (
    <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-2">
      <ActionCard
        title="Cronograma"
        subtitle="Línea de tiempo por fases"
        icon={<GanttChartSquare className="size-5" />}
        accent="gold"
        onClick={() => void navigate(`/projects/${projectId}/gantt`)}
      />
      <ActionCard
        title="Tareas"
        subtitle="Crea, asigna y da seguimiento"
        icon={<ListChecks className="size-5" />}
        accent="teal"
        onClick={() => void navigate(`/projects/${projectId}/tareas`)}
      />
    </div>
  );
}
