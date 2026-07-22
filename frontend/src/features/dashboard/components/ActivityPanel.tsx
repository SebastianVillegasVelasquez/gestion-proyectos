import { Activity } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

/**
 * Actividad reciente del sistema. El backend aún no expone un módulo de
 * actividad global (solo trazabilidad por proyecto), así que esta sección se
 * mantiene como marcador honesto: sin datos simulados, con un estado vacío
 * claro. Cuando exista el endpoint, este panel pasará a consumirlo.
 */
export function ActivityPanel() {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold">Actividad reciente</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
            <Activity className="size-5" />
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            No hay información para mostrar
          </p>
          <p className="max-w-xs text-xs text-slate-400 dark:text-slate-500">
            Aquí verás los movimientos recientes de tus proyectos cuando esta función esté
            disponible.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
