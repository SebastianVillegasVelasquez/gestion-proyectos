import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { Comment } from "../types";

const MAX_VISIBLE = 3;

function renderWithMentions(text: string, mentions: string[]): ReactNode[] {
  if (mentions.length === 0) {return [text];}

  let parts: (string | ReactNode)[] = [text];

  for (const mention of mentions) {
    const next: (string | ReactNode)[] = [];
    for (const part of parts) {
      if (typeof part !== "string") {
        next.push(part);
        continue;
      }
      const segments = part.split(`@${mention}`);
      segments.forEach((seg, i) => {
        if (i > 0) {
          next.push(
            <span key={`${mention}-${i}`} className="font-medium text-blue-600 dark:text-blue-400">
              @{mention}
            </span>
          );
        }
        if (seg) {next.push(seg);}
      });
    }
    parts = next;
  }

  return parts;
}

function CommentItem({ comment }: { comment: Comment }) {
  return (
    <div className="relative flex gap-2.5 rounded-md p-2 transition-colors duration-150 hover:bg-slate-100 dark:hover:bg-slate-800/50">
      {comment.isUnread && (
        <span className="absolute right-2 top-3 size-1.5 rounded-full bg-blue-500" />
      )}

      {/* Avatar */}
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white",
          comment.authorColor
        )}
      >
        {comment.authorInitials}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
            {comment.authorName}
          </span>
          <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
            {comment.timestamp}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          {renderWithMentions(comment.text, comment.mentions)}
        </p>
        <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
          {comment.project}
          <span className="mx-1 text-slate-300 dark:text-slate-600">·</span>
          {comment.section}
        </p>
      </div>
    </div>
  );
}

interface CommentsPanelProps {
  comments: Comment[];
}

export function CommentsPanel({ comments }: CommentsPanelProps) {
  const unreadCount = comments.filter((c) => c.isUnread).length;
  const visible = comments.slice(0, MAX_VISIBLE);
  const hasMore = comments.length > MAX_VISIBLE;

  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-semibold">Actividad reciente</CardTitle>
          {unreadCount > 0 && (
            <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400">
              {unreadCount} sin leer
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-0.5">
        {visible.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))}

        {hasMore && (
          <button
            type="button"
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-slate-200 py-1.5 text-[11px] font-medium text-slate-500 transition-colors duration-150 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200"
          >
            Ver más
            <ChevronDown className="size-3" />
          </button>
        )}

        {comments.length === 0 && (
          <p className="py-3 text-center text-[12px] text-slate-400 dark:text-slate-600">
            Sin actividad reciente
          </p>
        )}
      </CardContent>
    </Card>
  );
}
