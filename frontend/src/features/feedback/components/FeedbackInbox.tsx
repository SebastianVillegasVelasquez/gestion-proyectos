import { useMemo } from "react";
import { Inbox, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/common/AsyncStates";
import { useFeedbackList, useUpdateFeedbackStatus } from "../hooks/use-feedback";
import {
  FEEDBACK_STATUS_COLORS,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_STATUS_ORDER,
  FEEDBACK_TYPE_LABELS,
  type FeedbackResponse,
  type FeedbackStatus,
} from "../types";

function FeedbackCard({ item }: { item: FeedbackResponse }) {
  const updateStatus = useUpdateFeedbackStatus();
  const date = new Date(item.created_at).toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-gold-light px-2.5 py-0.5 text-xs font-medium text-brand-gold-dark dark:bg-brand-gold/15 dark:text-brand-gold">
          <MessageSquare className="size-3" />
          {FEEDBACK_TYPE_LABELS[item.feedback_type]}
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
            FEEDBACK_STATUS_COLORS[item.status],
          )}
        >
          {FEEDBACK_STATUS_LABELS[item.status]}
        </span>
      </div>

      <p className="whitespace-pre-wrap text-sm text-foreground">{item.message}</p>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <span className="truncate">
          {item.author_name ?? "Usuario eliminado"}
          {item.page && <span className="text-muted-foreground/70"> · {item.page}</span>}
          <span className="text-muted-foreground/70"> · {date}</span>
        </span>
        <label className="flex items-center gap-1.5">
          <span className="sr-only">Estado del feedback</span>
          <select
            value={item.status}
            disabled={updateStatus.isPending}
            aria-label={`Estado de: ${item.message.slice(0, 30)}`}
            onChange={(e) => {
              updateStatus.mutate({ id: item.id, status: e.target.value as FeedbackStatus });
            }}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-brand-gold disabled:opacity-50"
          >
            {FEEDBACK_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {FEEDBACK_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </article>
  );
}

/** Bandeja de feedback del sitio (solo rol developer). Listar y gestionar estado. */
export function FeedbackInbox() {
  const query = useFeedbackList();
  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-y-auto p-4 sm:p-6">
      <PageHeader
        title="Feedback"
        description="Lo que los usuarios reportan del sitio. Marca cada uno según lo gestiones."
      />

      {query.isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : query.isError ? (
        <ErrorState title="No se pudo cargar el feedback" onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Aún no hay feedback"
          hint="Cuando los usuarios envíen comentarios desde el botón flotante, aparecerán aquí."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <FeedbackCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

export default FeedbackInbox;
