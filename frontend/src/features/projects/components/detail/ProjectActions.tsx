import { useNavigate } from "react-router";
import { GanttChartSquare, ListChecks, ArrowRight } from "lucide-react";

function ActionCard({
  title,
  subtitle,
  icon,
  gradient,
  onClick,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-1 items-center gap-4 overflow-hidden rounded-xl p-5 text-left text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 ${gradient}`}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/20 backdrop-blur">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold">{title}</p>
        <p className="text-sm text-white/80">{subtitle}</p>
      </div>
      <ArrowRight className="size-5 shrink-0 opacity-70 transition-transform group-hover:translate-x-1" />
    </button>
  );
}

export function ProjectActions({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <ActionCard
        title="Cronograma"
        subtitle="Línea de tiempo por fases"
        icon={<GanttChartSquare className="size-6" />}
        gradient="bg-gradient-to-br from-blue-600 to-indigo-600"
        onClick={() => void navigate(`/projects/${projectId}/gantt`)}
      />
      <ActionCard
        title="Tareas"
        subtitle="Crea, asigna y da seguimiento"
        icon={<ListChecks className="size-6" />}
        gradient="bg-gradient-to-br from-emerald-600 to-teal-600"
        onClick={() => void navigate(`/projects/${projectId}/tareas`)}
      />
    </div>
  );
}
