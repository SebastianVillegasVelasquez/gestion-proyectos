import { useState, useRef, useEffect } from "react";
import { MessageSquare, AlertCircle, CheckCircle2, Send, AtSign } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeedbackComment, WorkspaceMember, CommentType, DeliverableStatus } from "../types";

// ── date helper ───────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = ms / 3_600_000;
  const d = ms / 86_400_000;
  if (h < 1) {
    return "Hace unos momentos";
  }
  if (h < 24) {
    return `Hace ${Math.floor(h)} h`;
  }
  if (d < 7) {
    return `Hace ${Math.floor(d)} días`;
  }
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

// ── comment type tokens ───────────────────────────────────────────────────

const COMMENT_TYPE_CONFIG: Record<
  CommentType,
  { label: string; Icon: React.ElementType; cardCls: string; labelCls: string }
> = {
  comentario: {
    label: "",
    Icon: MessageSquare,
    cardCls: "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
    labelCls: "",
  },
  solicitud_cambio: {
    label: "Solicitud de cambios",
    Icon: AlertCircle,
    cardCls: "border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/20",
    labelCls: "text-amber-700 dark:text-amber-400",
  },
  aprobacion: {
    label: "Aprobado",
    Icon: CheckCircle2,
    cardCls: "border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/20",
    labelCls: "text-emerald-700 dark:text-emerald-400",
  },
};

// ── highlight @mentions ───────────────────────────────────────────────────

function highlightMentions(text: string, members: WorkspaceMember[]) {
  const parts = text.split(/(@\w[\w\s]*)/g);
  return parts.map((part, i) => {
    const isMention = members.some((m) =>
      part.toLowerCase().includes(m.name.toLowerCase().split(" ")[0].toLowerCase()),
    );
    if (isMention && part.startsWith("@")) {
      return (
        <mark
          key={i}
          className="rounded bg-brand-teal-light px-0.5 font-medium text-brand-teal-dark dark:bg-brand-teal/15 dark:text-brand-teal"
        >
          {part}
        </mark>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ── single comment item ───────────────────────────────────────────────────

interface CommentItemProps {
  comment: FeedbackComment;
  members: WorkspaceMember[];
}

function CommentItem({ comment, members }: CommentItemProps) {
  const author = members.find((m) => m.id === comment.authorId);
  const cfg = COMMENT_TYPE_CONFIG[comment.type];
  const { Icon } = cfg;

  return (
    <div
      className={cn("rounded-xl border p-4", cfg.cardCls)}
      style={{
        animation: "tl-enter 0.3s ease-out both",
      }}
    >
      {/* Top: type label */}
      {cfg.label && (
        <div
          className={cn(
            "mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider",
            cfg.labelCls,
          )}
        >
          <Icon className="size-3.5" />
          {cfg.label}
        </div>
      )}

      {/* Author row */}
      <div className="flex items-center gap-2">
        {author && (
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
              author.avatarColor,
            )}
          >
            {author.initials}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
            {author?.name ?? "Desconocido"}
          </span>
          {author?.role === "lider" && (
            <span className="ml-1.5 rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
              Líder
            </span>
          )}
        </div>
        <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
          {relativeTime(comment.createdAt)}
        </span>
      </div>

      {/* Content */}
      <p className="mt-2 text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
        {highlightMentions(comment.content, members)}
      </p>
    </div>
  );
}

// ── compose area ──────────────────────────────────────────────────────────

interface ComposeAreaProps {
  members: WorkspaceMember[];
  currentUserId: string;
  isLeader: boolean;
  deliverableStatus: DeliverableStatus;
  onSubmit: (content: string, type: CommentType, mentions: string[]) => void;
}

function ComposeArea({ members, currentUserId, isLeader, onSubmit }: ComposeAreaProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const addMention = (member: WorkspaceMember) => {
    const mention = `@${member.name} `;
    setText((prev) => prev + mention);
    textareaRef.current?.focus();
  };

  const extractMentions = (content: string): string[] =>
    members
      .filter((m) =>
        content.toLowerCase().includes(m.name.toLowerCase().split(" ")[0].toLowerCase()),
      )
      .map((m) => m.id);

  const handleSend = (type: CommentType) => {
    if (!text.trim()) {
      return;
    }
    onSubmit(text.trim(), type, extractMentions(text));
    setText("");
  };

  const others = members.filter((m) => m.id !== currentUserId);

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
      {/* Mention bar */}
      {others.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <AtSign className="size-3 text-slate-400" />
          <span className="text-[10px] text-slate-400 dark:text-slate-500">Mencionar:</span>
          {others.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                addMention(m);
              }}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white transition-opacity hover:opacity-80",
                m.avatarColor,
              )}
              title={m.name}
            >
              {m.initials}
            </button>
          ))}
        </div>
      )}

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            handleSend("comentario");
          }
        }}
        rows={3}
        placeholder="Escribe tu comentario… (Ctrl+Enter para enviar)"
        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-slate-700 outline-none transition-colors focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500"
      />

      {/* Action buttons */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {/* Leader-only actions */}
        {isLeader && (
          <>
            <button
              type="button"
              onClick={() => {
                handleSend("solicitud_cambio");
              }}
              disabled={!text.trim()}
              className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[12px] font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-40 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50"
            >
              <AlertCircle className="size-3.5" />
              Solicitar Cambios
            </button>
            <button
              type="button"
              onClick={() => {
                handleSend("aprobacion");
              }}
              disabled={!text.trim()}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[12px] font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-40 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
            >
              <CheckCircle2 className="size-3.5" />
              Aprobar Entregable
            </button>
          </>
        )}

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => {
            handleSend("comentario");
          }}
          disabled={!text.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-brand-gold-dark disabled:opacity-40"
        >
          <Send className="size-3.5" />
          Enviar
        </button>
      </div>
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────

interface FeedbackThreadProps {
  comments: FeedbackComment[];
  members: WorkspaceMember[];
  leaderId: string;
  currentUserId: string;
  deliverableStatus: DeliverableStatus;
  onAddComment: (content: string, type: CommentType, mentions: string[]) => void;
}

export function FeedbackThread({
  comments,
  members,
  leaderId,
  currentUserId,
  deliverableStatus,
  onAddComment,
}: FeedbackThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const isLeader = currentUserId === leaderId;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  return (
    <div className="flex h-full flex-col overflow-hidden border-t border-slate-200 dark:border-slate-800">
      {/* Thread header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
        <MessageSquare className="size-4 text-slate-400 dark:text-slate-500" />
        <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-300">
          Hilo de retroalimentación
        </span>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {comments.length}
        </span>
      </div>

      {/* Messages list */}
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {comments.length === 0 && (
          <p className="py-6 text-center text-[12px] text-slate-400 dark:text-slate-500 italic">
            Sin comentarios aún. Sé el primero en comentar.
          </p>
        )}
        {comments.map((c) => (
          <CommentItem key={c.id} comment={c} members={members} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <ComposeArea
        members={members}
        currentUserId={currentUserId}
        isLeader={isLeader}
        deliverableStatus={deliverableStatus}
        onSubmit={onAddComment}
      />
    </div>
  );
}
