import http from "@/lib/http";

/** Lo que respalda una edición de avance: un archivo de la tarea o una versión
 *  de su entregable. */
export interface ProgressEvidence {
  kind: "file" | "deliverable_version";
  ref_id: string;
  /** Archivo abrible desde el archivador (puede faltar en versiones por URL). */
  file_id: string | null;
  label: string;
  content_type: string | null;
  created_at: string | null;
}

export interface ProgressUpdate {
  id: string;
  previous_pct: number;
  new_pct: number;
  note: string | null;
  author_id: string;
  author_name: string;
  created_at: string;
  evidence: ProgressEvidence | null;
}

export interface TaskProgress {
  task_id: string;
  project_id: string;
  progress_pct: number;
  manual_progress_pct: number | null;
  /** Ya resuelto por el servidor para quien pregunta: la UI no re-deduce la política. */
  can_edit: boolean;
  locked_reason: string | null;
  has_deliverable: boolean;
  updates: ProgressUpdate[];
  evidence_options: ProgressEvidence[];
}

/** Las tres vías de aportar evidencia; debe ir exactamente una. */
export type EvidenceChoice =
  | { kind: "upload"; file: File; attachToDeliverable: boolean }
  | { kind: "existing"; evidence: ProgressEvidence };

export interface RegisterProgressBody {
  progressPct: number;
  note?: string;
  evidence: EvidenceChoice;
}

function toForm(body: RegisterProgressBody): FormData {
  const form = new FormData();
  form.append("progress_pct", String(body.progressPct));
  if (body.note?.trim()) {
    form.append("note", body.note.trim());
  }
  const { evidence } = body;
  if (evidence.kind === "upload") {
    form.append("file", evidence.file);
    form.append("attach_to_deliverable", String(evidence.attachToDeliverable));
  } else if (evidence.evidence.kind === "deliverable_version") {
    form.append("deliverable_version_id", evidence.evidence.ref_id);
  } else {
    form.append("file_id", evidence.evidence.ref_id);
  }
  return form;
}

export const taskProgressApi = {
  get: (taskId: string) => http.get<TaskProgress>(`/tasks/${taskId}/progress`).then((r) => r.data),

  register: (taskId: string, body: RegisterProgressBody) =>
    http
      .post<TaskProgress>(`/tasks/${taskId}/progress`, toForm(body), {
        // Subir tarda más que una llamada normal: el timeout global cortaría un
        // archivo grande a media transferencia.
        timeout: 120_000,
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data),
};
