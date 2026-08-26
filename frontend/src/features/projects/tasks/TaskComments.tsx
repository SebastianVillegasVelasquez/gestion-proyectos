import { useMemo, useRef, useState } from "react";
import { AtSign, MessageSquare, Send, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/get-error-message";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useDirectory } from "../hooks/use-members";
import { useAddComment, useDeleteComment, useTaskComments } from "../hooks/use-tasks";

/** "hoy 14:05" / "24 ago" — basta para situar un comentario en la conversación. */
function when(iso: string | null): string {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const isToday = new Date().toDateString() === date.toDateString();
  return isToday
    ? `hoy ${date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`
    : date.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

/**
 * Conversación de una tarea, con menciones.
 *
 * Las menciones se eligen de una lista y se guardan como ids, no como texto:
 * dos personas pueden llamarse igual, y quien escribe debe poder decir a quién
 * apunta sin que el sistema lo adivine. Lo que se escribe en el cuerpo es solo
 * el nombre visible.
 */
export function TaskComments({ taskId }: { taskId: string }) {
  const { user } = useAuth();
  const commentsQuery = useTaskComments(taskId);
  const addComment = useAddComment(taskId);
  const deleteComment = useDeleteComment(taskId);
  const directoryQuery = useDirectory();

  const [body, setBody] = useState("");
  const [mentioned, setMentioned] = useState<{ id: string; label: string }[]>([]);
  const [pickingMention, setPickingMention] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const people = useMemo(
    () => (directoryQuery.data ?? []).map((u) => ({ id: u.id, label: `${u.name} ${u.last_name}` })),
    [directoryQuery.data],
  );
  const available = people.filter((p) => !mentioned.some((m) => m.id === p.id));

  const addMention = (person: { id: string; label: string }) => {
    setMentioned((prev) => [...prev, person]);
    // El nombre entra en el texto para que el comentario se lea solo; el id
    // viaja aparte, que es lo que el backend usa para avisar.
    setBody((prev) => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}@${person.label} `);
    setPickingMention(false);
    textareaRef.current?.focus();
  };

  const submit = () => {
    const clean = body.trim();
    if (!clean) {
      return;
    }
    addComment.mutate(
      {
        body: clean,
        // Solo los que siguen nombrados en el texto: si alguien borró la
        // mención mientras escribía, no tiene sentido avisarle.
        mentioned_user_ids: mentioned.filter((m) => clean.includes(m.label)).map((m) => m.id),
      },
      {
        onSuccess: () => {
          setBody("");
          setMentioned([]);
        },
      },
    );
  };

  const comments = commentsQuery.data ?? [];

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center gap-2">
        <MessageSquare className="size-4 text-brand-teal" />
        <h4 className="text-sm font-semibold text-foreground">Conversación</h4>
        {comments.length > 0 && (
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {comments.length}
          </span>
        )}
      </header>

      {commentsQuery.isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-accent" />
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Sin comentarios. Lo que se decida aquí queda junto a la tarea.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {comments.map((comment) => {
            const mine = comment.author_id === user?.id;
            return (
              <li
                key={comment.id}
                className="group rounded-lg border border-border bg-background px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-semibold text-foreground">
                    {comment.author_name ?? "Alguien"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {when(comment.created_at)}
                  </span>
                  {mine && (
                    <button
                      type="button"
                      onClick={() => {
                        deleteComment.mutate(comment.id);
                      }}
                      disabled={deleteComment.isPending}
                      aria-label="Borrar comentario"
                      className="ml-auto rounded p-1 text-muted-foreground opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 disabled:opacity-50 dark:hover:bg-rose-950/30"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{comment.body}</p>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <textarea
          ref={textareaRef}
          value={body}
          rows={2}
          aria-label="Escribe un comentario"
          placeholder="Escribe un comentario…"
          onChange={(e) => {
            setBody(e.target.value);
          }}
          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
        />

        {pickingMention && (
          <div className="max-h-40 overflow-y-auto rounded-lg border border-border">
            {available.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">No hay más personas.</p>
            ) : (
              available.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => {
                    addMention(person);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent"
                >
                  {person.label}
                </button>
              ))
            )}
          </div>
        )}

        {addComment.isError && (
          <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
            {getErrorMessage(addComment.error, "No se pudo publicar el comentario")}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setPickingMention((v) => !v);
            }}
            aria-pressed={pickingMention}
            className={cn(
              "flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition-colors",
              pickingMention
                ? "border-brand-teal text-brand-teal"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            <AtSign className="size-3.5" /> Mencionar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!body.trim() || addComment.isPending}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-brand-gold-dark disabled:opacity-60"
          >
            <Send className="size-3.5" />
            {addComment.isPending ? "Publicando…" : "Comentar"}
          </button>
        </div>
      </div>
    </section>
  );
}
