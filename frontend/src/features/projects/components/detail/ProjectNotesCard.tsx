import { useState } from "react";
import { NotebookPen, Plus, Trash2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getErrorMessage } from "@/utils/get-error-message";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  useCreateProjectNote,
  useDeleteProjectNote,
  useProjectNotes,
} from "../../hooks/use-projects";
import type { ProjectNote } from "../../types/api.types";

const TODAY = () => new Date().toISOString().slice(0, 10);

function formatNoteDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  const months = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  return `${d} ${months[Number(m) - 1]} ${y}`;
}

/**
 * Notas / recordatorios del proyecto: un lugar para dejar por escrito un
 * problema, una anomalía o algo que recordar, con su fecha (hoy por defecto,
 * pero editable). Cualquier miembro puede añadir; borrar queda para el autor o
 * un administrador (la regla la aplica el backend; aquí solo ocultamos el botón).
 */
export function ProjectNotesCard({ projectId }: { projectId: string }) {
  const { user, hasRole } = useAuth();
  const notesQuery = useProjectNotes(projectId);
  const createNote = useCreateProjectNote(projectId);
  const deleteNote = useDeleteProjectNote(projectId);

  const [adding, setAdding] = useState(false);
  const [content, setContent] = useState("");
  const [noteDate, setNoteDate] = useState(TODAY);

  const notes = notesQuery.data ?? [];
  const canDelete = (note: ProjectNote) =>
    hasRole(["admin", "super_admin"]) || note.author_id === user?.id;

  const resetForm = () => {
    setContent("");
    setNoteDate(TODAY());
    setAdding(false);
  };

  const submit = () => {
    const clean = content.trim();
    if (!clean) {
      return;
    }
    createNote.mutate(
      { content: clean, note_date: noteDate || undefined },
      { onSuccess: resetForm },
    );
  };

  return (
    <Card className="shrink-0 rounded-2xl">
      <CardContent className="flex flex-col gap-3 py-5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[15px] font-medium text-foreground">
            <NotebookPen className="size-4 text-brand-teal" /> Notas del proyecto
          </span>
          {!adding && (
            <button
              type="button"
              onClick={() => {
                setAdding(true);
              }}
              className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition hover:bg-brand-gold-dark"
            >
              <Plus className="size-3.5" /> Nota
            </button>
          )}
        </div>

        {/* Formulario para agregar una nota */}
        {adding && (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-accent/30 p-3">
            <textarea
              value={content}
              autoFocus
              rows={3}
              onChange={(e) => {
                setContent(e.target.value);
              }}
              placeholder="Ej. El cliente pidió adelantar la entrega del módulo 2…"
              className="w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Fecha
                <input
                  type="date"
                  value={noteDate}
                  onChange={(e) => {
                    setNoteDate(e.target.value);
                  }}
                  className="rounded-lg border border-border bg-card px-2 py-1 text-xs text-foreground outline-none focus:border-brand-gold"
                />
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={createNote.isPending}
                  className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  <X className="size-3.5" /> Cancelar
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!content.trim() || createNote.isPending}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {createNote.isPending ? "Guardando…" : "Guardar nota"}
                </button>
              </div>
            </div>
            {createNote.isError && (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {getErrorMessage(createNote.error, "No se pudo guardar la nota")}
              </p>
            )}
          </div>
        )}

        {/* Lista de notas */}
        {notesQuery.isLoading ? (
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
        ) : notes.length === 0 ? (
          !adding && (
            <p className="py-2 text-center text-sm italic text-muted-foreground">
              Aún no hay notas. Deja aquí un problema, una anomalía o algo que recordar.
            </p>
          )
        ) : (
          <ul className="flex flex-col gap-2">
            {notes.map((note) => (
              <li
                key={note.id}
                className="group/note flex gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
              >
                <span className="mt-0.5 shrink-0 rounded-md bg-brand-teal-light px-2 py-0.5 text-[11px] font-semibold tabular-nums text-brand-teal-dark dark:bg-brand-teal/15 dark:text-brand-teal">
                  {formatNoteDate(note.note_date)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                    {note.content}
                  </p>
                  {note.author_name && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">— {note.author_name}</p>
                  )}
                </div>
                {canDelete(note) && (
                  <button
                    type="button"
                    onClick={() => {
                      deleteNote.mutate(note.id);
                    }}
                    disabled={deleteNote.isPending}
                    aria-label="Borrar nota"
                    title="Borrar nota"
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-rose-500/10 hover:text-rose-600 focus:opacity-100 group-hover/note:opacity-100 disabled:opacity-50 dark:hover:text-rose-400"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
