import { useMemo } from "react";
import { X } from "lucide-react";
import { FileDestinationHint } from "@/features/files/components/FileDestinationHint";
import { useProjectFiles } from "@/features/files/hooks/use-project-files";
import type { DeliverableVersion } from "../types";
import { teamFolderOptions } from "../utils/delivery-folders";
import {
  useAddVersion,
  useCreateDeliverable,
  useDeliverables,
  useUploadVersionFile,
} from "../hooks/use-workspace";
import { RegisterDelivery } from "./DeliverableDetailView";

/**
 * «Entregar» una tarea de equipo: crea el entregable Y su primera versión en un
 * solo paso, sin salir de la vista donde se está trabajando (el espacio del
 * equipo o «Mis tareas»). Antes «Entregar» solo creaba el entregable en blanco y
 * mandaba a otra pestaña a subir la versión real — un segundo paso fácil de
 * abandonar a medias, con la tarea sin moverse de su estado.
 *
 * Es autónomo a propósito: pide sus propios datos (entregables y carpetas del
 * equipo), así cualquier pantalla lo monta sin cablear nada más.
 */
export function TeamTaskDeliveryDialog({
  teamId,
  projectId,
  userId,
  task,
  onClose,
}: {
  teamId: string;
  projectId: string;
  userId: string;
  task: { id: string; title: string };
  onClose: () => void;
}) {
  const deliverables = useDeliverables(teamId);
  const createDeliverable = useCreateDeliverable(teamId);
  const addVersion = useAddVersion(teamId);
  const uploadVersionFile = useUploadVersionFile(teamId);
  const filesTree = useProjectFiles(projectId, true);
  const folderOptions = useMemo(
    () => teamFolderOptions(filesTree.data?.root, teamId),
    [filesTree.data, teamId],
  );

  const pending =
    createDeliverable.isPending || addVersion.isPending || uploadVersionFile.isPending;

  /** El entregable de esta tarea: el que ya exista (una tarea, un entregable) o
   *  uno nuevo. Reusarlo permite seguir subiendo versiones en varias vueltas. */
  const withDeliverable = (onReady: (deliverableId: string) => void) => {
    const existing = (deliverables.data ?? []).find((d) => d.task_id === task.id);
    if (existing) {
      onReady(existing.id);
      return;
    }
    createDeliverable.mutate(
      { task_title: task.title, assignee_id: userId, task_id: task.id },
      {
        onSuccess: (d) => {
          onReady(d.id);
        },
      },
    );
  };

  // Con la casilla «marcar como entregada» sin marcar, el diálogo se queda
  // abierto para seguir entregando sobre la misma tarea.
  const deliverLink = (
    v: Omit<DeliverableVersion, "id" | "versionNumber">,
    markDelivered: boolean,
  ) => {
    withDeliverable((deliverableId) => {
      addVersion.mutate(
        {
          deliverableId,
          body: {
            type: v.type,
            url: v.url ?? undefined,
            note: v.note,
            observations: v.observations || undefined,
            mark_delivered: markDelivered,
          },
        },
        { onSuccess: markDelivered ? onClose : undefined },
      );
    });
  };

  /** Uno o varios archivos, en orden (uno por versión). Solo el ÚLTIMO lleva el
   *  `markDelivered` real: los anteriores nunca cierran la entrega por sí solos,
   *  para no dar por completada la tarea a medio subir. */
  const deliverFiles = (
    files: File[],
    note: string,
    observations: string,
    markDelivered: boolean,
    folderId: string | undefined,
  ) => {
    if (files.length === 0) {
      return;
    }
    withDeliverable((deliverableId) => {
      void files
        .reduce(
          (chain, file, i) =>
            chain.then(
              () =>
                new Promise<void>((resolve, reject) => {
                  uploadVersionFile.mutate(
                    {
                      deliverableId,
                      body: {
                        file,
                        note: note || file.name,
                        observations: observations || undefined,
                        markDelivered: i === files.length - 1 ? markDelivered : false,
                        folderId,
                      },
                    },
                    {
                      onSuccess: () => {
                        resolve();
                      },
                      onError: reject,
                    },
                  );
                }),
            ),
          Promise.resolve(),
        )
        .then(() => {
          if (markDelivered) {
            onClose();
          }
        })
        .catch(() => {
          /* el error ya queda en el estado de la mutación (uploadVersionFile.isError) */
        });
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Entregar tarea"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground">Entregar</h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{task.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <RegisterDelivery
            onAddVersion={deliverLink}
            onUploadFiles={deliverFiles}
            uploading={pending}
            currentVersion={0}
            uploadedBy=""
            folderOptions={folderOptions}
            destination={
              <FileDestinationHint
                projectId={projectId}
                taskId={task.id}
                workingPlace="la carpeta de tu equipo"
              />
            }
          />
        </div>
      </div>
    </div>
  );
}
