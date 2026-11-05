import { useEffect, useRef, useState, type ClipboardEvent, type ReactNode } from "react";
import { Paperclip, ShieldAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/get-error-message";
import { formatFileSize } from "@/features/files/utils/format-size";
import {
  useCreateIncident,
  useUpdateIncident,
  useUploadIncidentAttachment,
} from "../use-incidents";
import type { IncidentResponsible, ProjectIncident } from "../types";
import { RESPONSIBLE_META, RESPONSIBLE_ORDER } from "../utils";

const inputCls =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 disabled:cursor-not-allowed disabled:opacity-60";

const today = () => new Date().toISOString().slice(0, 10);

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

/** Evidencia que se subirá junto con el incidente nuevo. */
function QueuedEvidence({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">Evidencia</span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Paperclip className="size-3.5" /> Adjuntar
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            onChange([...files, ...Array.from(event.target.files ?? [])]);
            event.target.value = "";
          }}
        />
      </div>
      {files.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Imágenes, correos exportados o PDF. También puedes pegar una captura (Ctrl+V).
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${String(file.size)}-${String(index)}`}
              className="flex items-center gap-2 rounded-lg border border-border bg-accent/30 px-2.5 py-1.5 text-xs"
            >
              <span className="min-w-0 flex-1 truncate text-foreground">{file.name}</span>
              <span className="shrink-0 text-muted-foreground">{formatFileSize(file.size)}</span>
              <button
                type="button"
                aria-label={`Quitar ${file.name}`}
                onClick={() => {
                  onChange(files.filter((_, i) => i !== index));
                }}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Alta y edición de un incidente. Al crear admite evidencia (se sube justo
 * después de guardar); al editar, la evidencia se gestiona desde la tarjeta.
 */
export function IncidentFormModal({
  projectId,
  incident,
  onClose,
}: {
  projectId: string;
  /** Si viene, se edita; si no, se crea uno nuevo. */
  incident?: ProjectIncident;
  onClose: () => void;
}) {
  const editing = incident !== undefined;
  const locked = incident?.is_applied ?? false;

  const [title, setTitle] = useState(incident?.title ?? "");
  const [incidentDate, setIncidentDate] = useState(incident?.incident_date ?? today());
  const [responsible, setResponsible] = useState<IncidentResponsible>(
    incident?.responsible ?? "cliente",
  );
  const [impactDays, setImpactDays] = useState(String(incident?.impact_days ?? 0));
  const [description, setDescription] = useState(incident?.description ?? "");
  const [emailBody, setEmailBody] = useState(incident?.email_body ?? "");
  const [responseDate, setResponseDate] = useState(incident?.client_response_date ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);

  const createIncident = useCreateIncident(projectId);
  const updateIncident = useUpdateIncident(projectId);
  const uploadAttachment = useUploadIncidentAttachment(projectId);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const days = Number(impactDays);
  const daysValid = Number.isInteger(days) && days >= 0 && days <= 3650;
  const responseValid = responseDate === "" || responseDate >= incidentDate;
  const canSubmit = title.trim() !== "" && incidentDate !== "" && daysValid && responseValid;

  const saving = createIncident.isPending || updateIncident.isPending || uploadAttachment.isPending;
  const error = createIncident.error ?? updateIncident.error;

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    if (editing) {
      return;
    }
    const pasted = Array.from(event.clipboardData.files);
    if (pasted.length > 0) {
      setFiles((current) => [...current, ...pasted]);
    }
  };

  const submit = async () => {
    if (!canSubmit || saving) {
      return;
    }
    const base = {
      title: title.trim(),
      incident_date: incidentDate,
      responsible,
      description: description.trim() || null,
      email_body: emailBody.trim() || null,
      client_response_date: responseDate || null,
    };

    if (editing) {
      // Con el atraso ya reflejado los días no se tocan: el backend lo rechaza.
      const payload = locked ? base : { ...base, impact_days: days };
      await updateIncident.mutateAsync({ id: incident.id, payload });
      onClose();
      return;
    }

    const created = await createIncident.mutateAsync({ ...base, impact_days: days });
    const results = await Promise.allSettled(
      files.map((file) => uploadAttachment.mutateAsync({ id: created.id, file })),
    );
    const failed = files.filter((_, i) => results[i].status === "rejected");
    if (failed.length === 0) {
      onClose();
      return;
    }
    setFiles([]);
    setUploadWarning(
      `El incidente se guardó, pero no se pudo subir: ${failed.map((f) => f.name).join(", ")}. Adjúntalo de nuevo desde su tarjeta.`,
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={editing ? "Editar incidente" : "Registrar incidente"}
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        onPaste={handlePaste}
        className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <ShieldAlert className="size-4 text-brand-gold" />
            {editing ? "Editar incidente" : "Registrar incidente"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <Field label="¿Qué pasó?">
            <input
              value={title}
              autoFocus
              maxLength={200}
              onChange={(event) => {
                setTitle(event.target.value);
              }}
              placeholder="Ej. Sin acceso por SSH al servidor del cliente"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Fecha del incidente">
              <input
                type="date"
                value={incidentDate}
                onChange={(event) => {
                  setIncidentDate(event.target.value);
                }}
                className={inputCls}
              />
            </Field>
            <Field
              label="Días de atraso o impacto"
              hint={locked ? "Revierte el atraso del cronograma para cambiarlos." : undefined}
            >
              <input
                type="number"
                min={0}
                max={3650}
                value={impactDays}
                disabled={locked}
                onChange={(event) => {
                  setImpactDays(event.target.value);
                }}
                className={cn(inputCls, !daysValid && "border-rose-500")}
              />
            </Field>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">Responsabilidad</span>
            <div className="flex flex-wrap gap-2">
              {RESPONSIBLE_ORDER.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={responsible === value}
                  onClick={() => {
                    setResponsible(value);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                    responsible === value
                      ? cn("border-transparent", RESPONSIBLE_META[value].className)
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  {RESPONSIBLE_META[value].label}
                </button>
              ))}
            </div>
          </div>

          <Field label="Descripción (opcional)">
            <textarea
              value={description}
              rows={3}
              onChange={(event) => {
                setDescription(event.target.value);
              }}
              placeholder="Contexto, causa y cómo afectó al proyecto"
              className={cn(inputCls, "resize-y")}
            />
          </Field>

          <Field
            label="Cuerpo del correo (opcional)"
            hint="Pega aquí el correo que respalda el incidente."
          >
            <textarea
              value={emailBody}
              rows={4}
              onChange={(event) => {
                setEmailBody(event.target.value);
              }}
              className={cn(inputCls, "resize-y font-mono text-xs")}
            />
          </Field>

          <Field
            label="Respuesta del cliente (opcional)"
            hint="Puedes dejarlo vacío y completarlo cuando el cliente responda."
          >
            <input
              type="date"
              value={responseDate}
              min={incidentDate}
              onChange={(event) => {
                setResponseDate(event.target.value);
              }}
              className={cn(inputCls, !responseValid && "border-rose-500")}
            />
          </Field>

          {!editing && <QueuedEvidence files={files} onChange={setFiles} />}

          {uploadWarning && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              {uploadWarning}
            </p>
          )}
          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400">
              {getErrorMessage(error, "No se pudo guardar el incidente")}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            {uploadWarning ? "Cerrar" : "Cancelar"}
          </button>
          {!uploadWarning && (
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSubmit || saving}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Guardando…" : editing ? "Guardar cambios" : "Registrar incidente"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
