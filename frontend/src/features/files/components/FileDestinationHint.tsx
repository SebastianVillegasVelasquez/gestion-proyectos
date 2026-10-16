import { FolderCheck } from "lucide-react";
import { useTaskDestination } from "../hooks/use-project-files";

/**
 * Dónde acabará el archivo de una tarea. Mientras se trabaja (versiones del
 * entregable, evidencias de avance) los archivos viven en `workingPlace`; al
 * aprobarse el entregable, el final queda además enlazado en la carpeta que la
 * estructura reservó para el elemento de la tarea.
 */
export function FileDestinationHint({
  projectId,
  taskId,
  workingPlace,
}: {
  projectId: string;
  taskId: string;
  /** Dónde se guardan los archivos mientras tanto: «la carpeta del equipo»… */
  workingPlace: string;
}) {
  const destination = useTaskDestination(projectId, taskId).data;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-accent/30 px-3 py-2 text-[12px] text-muted-foreground">
      <FolderCheck className="mt-0.5 size-3.5 shrink-0 text-brand-teal-dark dark:text-brand-teal" />
      <p className="min-w-0">
        Se guarda en <strong className="text-foreground">{workingPlace}</strong>.{" "}
        {destination ? (
          <>
            Al aprobarse, el archivo final se enlaza en{" "}
            <strong className="break-words text-foreground">{destination.path.join(" › ")}</strong>.
          </>
        ) : (
          "Esta tarea aún no tiene carpeta en la estructura del proyecto."
        )}
      </p>
    </div>
  );
}
