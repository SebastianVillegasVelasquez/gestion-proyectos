import { useState } from "react";
import { FileText, Link2, Lock, Paperclip, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/get-error-message";
import { filesApi } from "@/features/files/api/files.api";
import type { ProgressEvidence, TaskProgress } from "../api/task-progress.api";
import { useRegisterTaskProgress, useTaskProgress } from "../hooks/use-task-progress";

type EvidenceMode = "upload" | "existing";

function EvidenceLink({ projectId, evidence }: { projectId: string; evidence: ProgressEvidence }) {
  const Icon = evidence.kind === "file" ? FileText : Link2;
  const fileId = evidence.file_id;
  if (!fileId) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="size-3" /> {evidence.label}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        void filesApi.download(projectId, fileId, evidence.label);
      }}
      className="inline-flex max-w-full items-center gap-1 truncate text-xs font-medium text-brand-teal-dark hover:underline dark:text-brand-teal"
      title="Descargar evidencia"
    >
      <Icon className="size-3 shrink-0" /> <span className="truncate">{evidence.label}</span>
    </button>
  );
}

function History({ progress }: { progress: TaskProgress }) {
  if (progress.updates.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Aún no hay ediciones: el avance sale del estado de la tarea.
      </p>
    );
  }
  return (
    <ol className="flex flex-col gap-2">
      {progress.updates.map((u) => (
        <li key={u.id} className="rounded-lg border border-border/60 bg-background px-3 py-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold tabular-nums text-foreground">
              {u.previous_pct}% → {u.new_pct}%
            </span>
            <span className="text-muted-foreground">
              {u.author_name} · {new Date(u.created_at).toLocaleString("es-CO")}
            </span>
          </div>
          {u.note && <p className="mt-1 text-xs text-foreground">{u.note}</p>}
          {u.evidence ? (
            <div className="mt-1">
              <EvidenceLink projectId={progress.project_id} evidence={u.evidence} />
            </div>
          ) : (
            <p className="mt-1 text-[11px] italic text-muted-foreground">
              La evidencia ya no está disponible.
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * Edición del avance de una tarea propia. Cada cambio exige evidencia —subir un
 * archivo, o reutilizar uno ya vinculado a la tarea / una versión de su
 * entregable— y queda en la bitácora que se ve debajo.
 */
export function TaskProgressDialog({
  taskId,
  taskTitle,
  onClose,
}: {
  taskId: string;
  taskTitle: string;
  onClose: () => void;
}) {
  const query = useTaskProgress(taskId);
  const register = useRegisterTaskProgress(taskId);
  const progress = query.data;

  const [pct, setPct] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<EvidenceMode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [attach, setAttach] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  const current = progress?.progress_pct ?? 0;
  const value = pct ?? current;
  const existing = progress?.evidence_options.find((o) => o.ref_id === existingId) ?? null;
  const evidenceReady = mode === "upload" ? file !== null : existing !== null;
  const canSubmit =
    progress?.can_edit === true && value !== current && evidenceReady && !register.isPending;

  const submit = () => {
    if (!canSubmit) {
      return;
    }
    const evidence =
      mode === "upload" && file
        ? ({ kind: "upload", file, attachToDeliverable: attach } as const)
        : existing
          ? ({ kind: "existing", evidence: existing } as const)
          : null;
    if (!evidence) {
      return;
    }
    register.mutate(
      { progressPct: value, note, evidence },
      {
        onSuccess: () => {
          setPct(null);
          setNote("");
          setFile(null);
          setAttach(false);
          setExistingId(null);
        },
      },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Avance de ${taskTitle}`}
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Avance de la tarea
            </p>
            <h3 className="truncate text-base font-semibold text-foreground">{taskTitle}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
          {query.isLoading && <div className="h-32 animate-pulse rounded-xl bg-accent" />}
          {query.isError && (
            <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
              No se pudo cargar el avance.
            </p>
          )}

          {progress && !progress.can_edit && (
            <p className="flex items-start gap-2 rounded-lg bg-accent/60 px-3 py-2 text-xs text-muted-foreground">
              <Lock className="mt-0.5 size-3.5 shrink-0" />
              {progress.locked_reason ?? "Solo el responsable de la tarea edita su avance."}
            </p>
          )}

          {progress?.can_edit && (
            <>
              <div>
                <div className="mb-1 flex items-baseline justify-between">
                  <label htmlFor="progress-range" className="text-xs font-semibold text-foreground">
                    Nuevo avance
                  </label>
                  <span className="text-2xl font-semibold tabular-nums text-foreground">
                    {value}%
                  </span>
                </div>
                <input
                  id="progress-range"
                  type="range"
                  min={0}
                  max={99}
                  step={5}
                  value={value}
                  onChange={(e) => {
                    setPct(Number(e.target.value));
                  }}
                  className="w-full accent-primary"
                />
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Ahora: {current}%. El 100% se alcanza al entregar la tarea.
                </p>
              </div>

              <div>
                <label htmlFor="progress-note" className="text-xs font-semibold text-foreground">
                  Qué avanzaste{" "}
                  <span className="font-normal text-muted-foreground">(opcional)</span>
                </label>
                <textarea
                  id="progress-note"
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                  }}
                  rows={2}
                  maxLength={500}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand-gold"
                />
              </div>

              <fieldset className="rounded-xl border border-border p-3">
                <legend className="px-1 text-xs font-semibold text-foreground">
                  Evidencia <span className="text-rose-500">*</span>
                </legend>
                <div className="mb-3 flex gap-1 rounded-lg border border-border bg-background p-1">
                  {(
                    [
                      ["upload", "Subir archivo", Upload],
                      ["existing", "Ya vinculada", Paperclip],
                    ] as const
                  ).map(([key, label, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setMode(key);
                      }}
                      aria-pressed={mode === key}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
                        mode === key
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className="size-3.5" /> {label}
                    </button>
                  ))}
                </div>

                {mode === "upload" ? (
                  <div className="flex flex-col gap-2">
                    <input
                      type="file"
                      aria-label="Archivo de evidencia"
                      onChange={(e) => {
                        setFile(e.target.files?.[0] ?? null);
                      }}
                      className="text-xs file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:font-medium"
                    />
                    {progress.has_deliverable && (
                      <label className="flex items-center gap-2 text-xs text-foreground">
                        <input
                          type="checkbox"
                          checked={attach}
                          onChange={(e) => {
                            setAttach(e.target.checked);
                          }}
                        />
                        Añadirlo también como versión del entregable de la tarea
                      </label>
                    )}
                  </div>
                ) : progress.evidence_options.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Esta tarea aún no tiene archivos ni versiones vinculados. Sube uno.
                  </p>
                ) : (
                  <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                    {progress.evidence_options.map((o) => (
                      <li key={`${o.kind}-${o.ref_id}`}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent">
                          <input
                            type="radio"
                            name="existing-evidence"
                            checked={existingId === o.ref_id}
                            onChange={() => {
                              setExistingId(o.ref_id);
                            }}
                          />
                          <span className="min-w-0 flex-1 truncate">{o.label}</span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {o.kind === "file" ? "archivo" : "entrega"}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </fieldset>

              {register.isError && (
                <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
                  {getErrorMessage(register.error, "No se pudo guardar el avance")}
                </p>
              )}
            </>
          )}

          {progress && (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Historial
              </h4>
              <History progress={progress} />
            </section>
          )}
        </div>

        {progress?.can_edit && (
          <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-brand-gold-dark disabled:opacity-50"
            >
              {register.isPending ? "Guardando…" : "Guardar avance"}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
