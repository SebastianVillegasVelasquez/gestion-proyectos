import { Card, CardContent } from "@/components/ui/card";
import type { ProjectAnalytics } from "../../api/analytics.api";
import { bdays } from "../../utils/format";
import { BurnupChart } from "../viz/BurnupChart";
import { HealthCard } from "../viz/HealthCard";
import { KpiTile } from "../viz/KpiTile";
import { PlanProgressCard } from "../viz/PlanProgressCard";
import { StatusDonut } from "../viz/StatusDonut";
import { ThroughputChart } from "../viz/ThroughputChart";

export function GeneralTab({ data }: { data: ProjectAnalytics }) {
  const ov = data.overview;
  const doneThisPeriod = ov.throughput_last_weeks.reduce((s, w) => s + w.count, 0);
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Avance"
          value={`${String(ov.progress_pct)}%`}
          hint={`${String(ov.total_tasks)} tareas`}
        />
        <KpiTile
          label="Vencidas abiertas"
          value={ov.overdue_open}
          hint="sin cerrar y fuera de plazo"
          tone={ov.overdue_open > 0 ? "bad" : undefined}
        />
        <KpiTile
          label="En riesgo (≤1 sem.)"
          value={ov.at_risk_open}
          hint="vencen en los próximos 7 días"
          tone={ov.at_risk_open > 0 ? "warn" : undefined}
        />
        <KpiTile
          label="Desviación media"
          value={bdays(ov.avg_schedule_slip_bdays)}
          hint="+ = cierra tarde"
          tone={ov.avg_schedule_slip_bdays > 0 ? "warn" : undefined}
        />
        <KpiTile
          label="Cycle time (mediana)"
          value={bdays(ov.cycle_time_p50_bdays)}
          hint="inicio → cierre"
        />
        <KpiTile
          label="Cycle time (p90)"
          value={bdays(ov.cycle_time_p90_bdays)}
          hint="el 90 % cierra antes de este plazo"
        />
        <KpiTile
          label="Retrabajo"
          value={`${String(ov.rework_rate_pct)}%`}
          hint="tareas devueltas alguna vez"
          tone={ov.rework_rate_pct >= 20 ? "warn" : undefined}
        />
        <KpiTile
          label="Completadas (8 sem.)"
          value={doneThisPeriod}
          hint="en las últimas 8 semanas"
          tone="good"
        />
      </div>

      <PlanProgressCard plan={data.plan} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[3fr_2fr]">
        <HealthCard health={data.health} />
        <StatusDonut overview={ov} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-6">
            <h3 className="mb-1 text-xl font-semibold tracking-tight text-foreground">
              Avance en el tiempo
            </h3>
            <BurnupChart points={data.burnup.points} scope={data.burnup.total_scope} />
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-6">
            <h3 className="mb-3 text-xl font-semibold tracking-tight text-foreground">
              Tareas completadas por semana
            </h3>
            <ThroughputChart weeks={ov.throughput_last_weeks} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
