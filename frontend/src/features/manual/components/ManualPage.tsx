import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { ArrowLeft, ArrowRight, BookOpen, ListTree, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/common/AsyncStates";
import { DEFAULT_ARTICLE_ID, MANUAL_ARTICLES, MANUAL_SECTIONS } from "../manual-content";
import { filterSections } from "../utils/search";
import type { ManualArticle, ManualSection } from "../types";
import { ManualBlockView } from "./manual-blocks";

/** Parámetro de la URL: `/manual?tema=entregar-tarea` es un enlace compartible
 *  a un tema concreto, que es como la gente pasa ayuda a un compañero. */
const PARAM = "tema";

function LeaderBadge() {
  return (
    <span
      title="Solo aplica si lideras o supervisas un equipo"
      className="shrink-0 rounded bg-brand-teal/10 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-brand-teal-dark dark:text-brand-teal"
    >
      Líder
    </span>
  );
}

// ── Índice ──────────────────────────────────────────────────────────────────

function ManualIndex({
  sections,
  activeId,
  term,
  onTerm,
  onSelect,
}: {
  sections: ManualSection[];
  activeId: string;
  term: string;
  onTerm: (value: string) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          value={term}
          onChange={(e) => {
            onTerm(e.target.value);
          }}
          placeholder="Buscar en el manual…"
          aria-label="Buscar en el manual"
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
        />
        {term && (
          <button
            type="button"
            onClick={() => {
              onTerm("");
            }}
            aria-label="Limpiar la búsqueda"
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </label>

      {sections.length === 0 ? (
        <p className="px-1 text-[13px] text-muted-foreground">
          Nada coincide con «{term}». Prueba con otra palabra.
        </p>
      ) : (
        <nav aria-label="Temas del manual" className="flex flex-col gap-5">
          {sections.map((section) => (
            <div key={section.id}>
              <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <section.Icon className="size-3.5 shrink-0" />
                {section.title}
              </p>
              <ul className="flex flex-col gap-0.5">
                {section.articles.map((article) => {
                  const isActive = article.id === activeId;
                  return (
                    <li key={article.id}>
                      <button
                        type="button"
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => {
                          onSelect(article.id);
                        }}
                        className={cn(
                          // La barra dorada de la izquierda es lo que marca el
                          // tema abierto sin depender solo del color del texto.
                          "flex w-full items-center gap-2 border-l-2 py-1.5 pl-2.5 pr-2 text-left text-[13px] transition-colors",
                          isActive
                            ? "border-brand-gold bg-brand-gold/10 font-semibold text-foreground"
                            : "border-transparent text-muted-foreground hover:border-border hover:bg-accent/60 hover:text-foreground",
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{article.title}</span>
                        {article.audience === "lider" && <LeaderBadge />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      )}
    </div>
  );
}

// ── Artículo ────────────────────────────────────────────────────────────────

function ManualArticleView({
  section,
  article,
}: {
  section: ManualSection;
  article: ManualArticle;
}) {
  return (
    <>
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-teal-dark dark:text-brand-teal">
        <section.Icon className="size-3.5" />
        {section.title}
      </p>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{article.title}</h2>
        {article.audience === "lider" && <LeaderBadge />}
      </div>
      <p className="mb-6 text-[15px] text-muted-foreground">{article.summary}</p>

      <div className="flex flex-col gap-4">
        {article.blocks.map((block, i) => (
          <ManualBlockView key={i} block={block} />
        ))}
      </div>
    </>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────

/**
 * Manual de usuario: índice de temas a la izquierda, el tema abierto a la
 * derecha. El contenido vive en `manual-content.ts`, así que añadir un tema es
 * escribir texto — esta pantalla solo lo navega.
 *
 * El tema abierto va en la URL (`?tema=…`) y no en el estado: así un enlace a
 * un tema concreto se puede pegar en un chat, que es como la gente se pasa la
 * ayuda entre compañeros.
 */
export function ManualPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [term, setTerm] = useState("");
  // En móvil el índice arranca cerrado: la pantalla es para leer el tema, no
  // para mirar una lista de treinta enlaces antes de llegar a él.
  const [indexOpen, setIndexOpen] = useState(false);

  const requested = searchParams.get(PARAM);
  const current = useMemo(
    () =>
      MANUAL_ARTICLES.find((entry) => entry.article.id === requested) ??
      MANUAL_ARTICLES.find((entry) => entry.article.id === DEFAULT_ARTICLE_ID),
    [requested],
  );

  const filtered = useMemo(() => filterSections(MANUAL_SECTIONS, term), [term]);

  const position = MANUAL_ARTICLES.findIndex((e) => e.article.id === current?.article.id);
  const previous = position > 0 ? MANUAL_ARTICLES[position - 1] : null;
  const next = position < MANUAL_ARTICLES.length - 1 ? MANUAL_ARTICLES[position + 1] : null;

  const topRef = useRef<HTMLDivElement>(null);
  // Al cambiar de tema se vuelve arriba: sin esto, saltar de un artículo largo
  // a otro deja al lector a mitad del texto nuevo. Se salta el primer render
  // (`mounted`) para no robarle el scroll a quien llega por un enlace.
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) {
      topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
    mounted.current = true;
  }, [current?.article.id]);

  const open = (id: string) => {
    setSearchParams({ [PARAM]: id });
    setIndexOpen(false);
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] flex-1 overflow-y-auto p-4 sm:p-6">
      <PageHeader
        title="Manual de usuario"
        description="Cómo trabajar en tu equipo y entregar lo tuyo, paso a paso."
      />

      {/* Móvil: el índice se despliega bajo un botón. */}
      <button
        type="button"
        onClick={() => {
          setIndexOpen((v) => !v);
        }}
        aria-expanded={indexOpen}
        className="mb-4 flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground lg:hidden"
      >
        <span className="flex items-center gap-2">
          <ListTree className="size-4 text-brand-gold-dark dark:text-brand-gold" />
          {indexOpen ? "Ocultar temas" : "Ver todos los temas"}
        </span>
        <span className="text-[12px] font-normal text-muted-foreground">
          {MANUAL_ARTICLES.length} temas
        </span>
      </button>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside
          className={cn(
            "shrink-0 lg:sticky lg:top-4 lg:block lg:max-h-[calc(100vh-7rem)] lg:w-64 lg:overflow-y-auto lg:pr-1",
            indexOpen ? "block" : "hidden",
          )}
        >
          <ManualIndex
            sections={filtered}
            activeId={current?.article.id ?? ""}
            term={term}
            onTerm={setTerm}
            onSelect={open}
          />
        </aside>

        <article className="min-w-0 flex-1">
          <div ref={topRef} className="scroll-mt-4" />
          {current ? (
            <>
              <ManualArticleView section={current.section} article={current.article} />

              {/* Anterior / siguiente: el manual se puede leer de corrido. */}
              <nav className="mt-10 flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:justify-between">
                {previous ? (
                  <button
                    type="button"
                    onClick={() => {
                      open(previous.article.id);
                    }}
                    className="group flex min-w-0 items-center gap-2 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-accent"
                  >
                    <ArrowLeft className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block text-[11px] text-muted-foreground">Anterior</span>
                      <span className="block truncate text-[13px] font-medium text-foreground">
                        {previous.article.title}
                      </span>
                    </span>
                  </button>
                ) : (
                  <span />
                )}
                {next && (
                  <button
                    type="button"
                    onClick={() => {
                      open(next.article.id);
                    }}
                    className="group flex min-w-0 items-center gap-2 rounded-lg border border-border px-3 py-2 text-right transition-colors hover:bg-accent sm:flex-row-reverse"
                  >
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block text-[11px] text-muted-foreground">Siguiente</span>
                      <span className="block truncate text-[13px] font-medium text-foreground">
                        {next.article.title}
                      </span>
                    </span>
                  </button>
                )}
              </nav>
            </>
          ) : (
            <EmptyState
              icon={BookOpen}
              title="Ese tema ya no existe"
              hint="Elige uno del índice de la izquierda."
            />
          )}
        </article>
      </div>
    </div>
  );
}

export default ManualPage;
