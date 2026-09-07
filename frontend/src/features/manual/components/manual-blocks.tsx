import { AlertTriangle, Info, Lightbulb, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseInline } from "../utils/inline";
import { resolveVideo } from "../utils/video";
import type { ManualBlock, NoteTone } from "../types";

/** Texto de un bloque con sus marcas ya resueltas. */
export function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((token, i) => {
        if (token.kind === "ui") {
          return (
            <span
              key={i}
              className="mx-px inline-block whitespace-nowrap rounded border border-border bg-accent/70 px-1.5 py-px text-[0.9em] font-medium text-foreground"
            >
              {token.value}
            </span>
          );
        }
        if (token.kind === "strong") {
          return (
            <strong key={i} className="font-semibold text-foreground">
              {token.value}
            </strong>
          );
        }
        return <span key={i}>{token.value}</span>;
      })}
    </>
  );
}

const NOTE_META: Record<NoteTone, { Icon: typeof Info; wrap: string; head: string }> = {
  tip: {
    Icon: Lightbulb,
    wrap: "border-brand-teal/30 bg-brand-teal/5",
    head: "text-brand-teal-dark dark:text-brand-teal",
  },
  warn: {
    Icon: AlertTriangle,
    wrap: "border-amber-300/60 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/20",
    head: "text-amber-700 dark:text-amber-400",
  },
  info: {
    Icon: Info,
    wrap: "border-border bg-accent/40",
    head: "text-foreground",
  },
};

export function ManualBlockView({ block }: { block: ManualBlock }) {
  switch (block.kind) {
    case "p":
      return (
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          <Inline text={block.text} />
        </p>
      );

    case "steps":
      return (
        // Contador propio en vez de `list-decimal`: el número va en su propia
        // pastilla dorada y el texto queda alineado aunque ocupe varias líneas.
        <ol className="flex flex-col gap-2.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-[12px] font-bold tabular-nums text-brand-gold-dark dark:text-brand-gold">
                {i + 1}
              </span>
              <span className="pt-0.5 text-[15px] leading-relaxed text-muted-foreground">
                <Inline text={item} />
              </span>
            </li>
          ))}
        </ol>
      );

    case "list":
      return (
        <ul className="flex flex-col gap-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-brand-gold" />
              <span className="text-[15px] leading-relaxed text-muted-foreground">
                <Inline text={item} />
              </span>
            </li>
          ))}
        </ul>
      );

    case "note": {
      const meta = NOTE_META[block.tone];
      return (
        <div className={cn("flex gap-3 rounded-xl border p-3.5", meta.wrap)}>
          <meta.Icon className={cn("mt-0.5 size-4 shrink-0", meta.head)} />
          <div className="min-w-0">
            {block.title && (
              <p className={cn("mb-0.5 text-[13px] font-semibold", meta.head)}>{block.title}</p>
            )}
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              <Inline text={block.text} />
            </p>
          </div>
        </div>
      );
    }

    case "legend":
      return (
        <ul className="flex flex-col gap-2">
          {block.items.map((item) => (
            <li key={item.label} className="flex flex-wrap items-baseline gap-2">
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  item.chip,
                )}
              >
                {item.label}
              </span>
              <span className="text-[14px] leading-relaxed text-muted-foreground">
                <Inline text={item.desc} />
              </span>
            </li>
          ))}
        </ul>
      );

    case "video": {
      const source = resolveVideo(block.src);
      if (source.kind === "none") {
        // El apartado existe antes que el video: se dice que viene, en vez de
        // dejar un reproductor vacío que parece un fallo de carga.
        return (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-accent/30 px-6 py-10 text-center">
            <Video className="size-7 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">El video está en camino</p>
            <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              Todavía no está publicado. Mientras tanto, los temas del índice cubren lo mismo paso a
              paso.
            </p>
          </div>
        );
      }
      return (
        <figure className="flex flex-col gap-2">
          <div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
            {source.kind === "embed" ? (
              <iframe
                src={source.url}
                title={block.caption}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="size-full"
              />
            ) : (
              // Sin pista de subtítulos: el video es material de apoyo y todo
              // su contenido está escrito, paso a paso, en los temas del índice.
              <video src={source.url} controls className="size-full">
                Tu navegador no puede reproducir este video.
              </video>
            )}
          </div>
          <figcaption className="text-[13px] text-muted-foreground">{block.caption}</figcaption>
        </figure>
      );
    }

    case "table":
      return (
        // Las tablas del manual pueden ser anchas: scrollean dentro de su caja
        // en vez de empujar la página entera a lo ancho.
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[420px] border-collapse text-left">
            <thead>
              <tr className="bg-accent/50">
                {block.head.map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-t border-border">
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={cn(
                        "px-3 py-2 align-top text-[14px] leading-relaxed",
                        j === 0 ? "font-medium text-foreground" : "text-muted-foreground",
                      )}
                    >
                      <Inline text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}
