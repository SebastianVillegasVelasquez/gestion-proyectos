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
// Un acento de color por nota (rota entre los tonos de marca). Cada entrada
// combina el color de la barra lateral y el de la pastilla de fecha para que la
// tarjeta se sienta diseñada y no genérica.
const NOTE_ACCENTS = [
  { bar: "bg-brand-teal", chip: "bg-brand-teal/10 text-brand-teal-dark dark:text-brand-teal" },
  { bar: "bg-brand-gold", chip: "bg-brand-gold/15 text-brand-gold-dark dark:text-brand-gold" },
  { bar: "bg-brand-blue", chip: "bg-brand-blue/10 text-brand-blue" },
  { bar: "bg-emerald-500", chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}

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
      {/* `CardContent` trae `pt-0` (asume un `CardHeader` arriba que ya puso el
          padding superior); esta card no usa header, así que sin `sm:pt-5`
          explícito el título quedaba pegado al borde a partir de `sm`. */}
      <CardContent className="flex flex-col gap-4 py-5 sm:pt-5">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2.5 text-[15px] font-semibold text-foreground">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal-dark dark:text-brand-teal">
              <NotebookPen className="size-[18px]" />
            </span>
            Notas del proyecto
            {notes.length > 0 && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                {notes.length}
              </span>
            )}
          </span>
          {!adding && (
            <button
              type="button"
              onClick={() => {
                setAdding(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-brand-gold-dark"
            >
              <Plus className="size-3.5" /> Añadir nota
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

        {/* Lista de notas: tarjetas tipo "nota adhesiva", en cuadrícula */}
        {notesQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : notes.length === 0 ? (
          !adding && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-accent/20 px-4 py-4 text-center sm:flex-row sm:text-left">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal-dark dark:text-brand-teal">
                <NotebookPen className="size-[18px]" />
              </span>
              <p className="flex-1 text-sm text-muted-foreground">
                Aún no hay notas. Deja aquí un problema, una anomalía o algo que recordar.
              </p>
            </div>
          )
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {notes.map((note, idx) => {
              const accent = NOTE_ACCENTS[idx % NOTE_ACCENTS.length];
              return (
                <li
                  key={note.id}
                  className="group/note relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-4 pl-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  {/* Barra de acento a la izquierda */}
                  <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${accent.bar}`} />
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ${accent.chip}`}
                    >
                      {formatNoteDate(note.note_date)}
                    </span>
                    {canDelete(note) && (
                      <button
                        type="button"
                        onClick={() => {
                          deleteNote.mutate(note.id);
                        }}
                        disabled={deleteNote.isPending}
                        aria-label="Borrar nota"
                        title="Borrar nota"
                        className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-rose-500/10 hover:text-rose-600 focus:opacity-100 group-hover/note:opacity-100 disabled:opacity-50 dark:hover:text-rose-400"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="line-clamp-6 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                    {note.content}
                  </p>
                  {note.author_name && (
                    <div className="mt-auto flex items-center gap-2 border-t border-accent/60 pt-2.5">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-teal-light text-[10px] font-bold text-brand-teal-dark dark:bg-brand-teal/15 dark:text-brand-teal">
                        {initials(note.author_name)}
                      </span>
                      <p className="truncate text-xs text-muted-foreground">{note.author_name}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
