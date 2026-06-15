import { NODE_TYPE_LABELS } from "../../types/labels";
import type { NodeType } from "../../types/api.types";
import type { BuilderState } from "../../builder/use-builder-state";

const NODE_TYPES: NodeType[] = ["PROGRAMA", "CURSO", "MODULO"];

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  );
}

export function BuilderDetail({ builder }: { builder: BuilderState }) {
  const { selected } = builder;

  if (!selected) {
    return (
      <p className="text-sm italic text-slate-400 dark:text-slate-500">
        Selecciona el proyecto, una fase o un elemento para editarlo.
      </p>
    );
  }

  if (selected.kind === "project") {
    const p = builder.project;
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Proyecto</h3>
        <Field label="Nombre *">
          <input
            className={inputCls}
            value={p.name}
            onChange={(e) => {
              builder.setProjectField("name", e.target.value);
            }}
            placeholder="Diplomado en..."
          />
        </Field>
        <Field label="Cliente">
          <input
            className={inputCls}
            value={p.client_name}
            onChange={(e) => {
              builder.setProjectField("client_name", e.target.value);
            }}
          />
        </Field>
        <Field label="Descripción">
          <textarea
            className={inputCls}
            rows={3}
            value={p.description}
            onChange={(e) => {
              builder.setProjectField("description", e.target.value);
            }}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Inicio (opcional)">
            <input
              type="date"
              className={inputCls}
              value={p.start_date}
              onChange={(e) => {
                builder.setProjectField("start_date", e.target.value);
              }}
            />
          </Field>
          <Field label="Fin (opcional)">
            <input
              type="date"
              className={inputCls}
              value={p.end_date}
              onChange={(e) => {
                builder.setProjectField("end_date", e.target.value);
              }}
            />
          </Field>
        </div>
      </div>
    );
  }

  if (selected.kind === "phase") {
    const phase = builder.phases.find((ph) => ph.tempId === selected.id);
    if (!phase) {
      return null;
    }
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Fase</h3>
        <Field label="Nombre">
          <input
            className={inputCls}
            value={phase.name}
            onChange={(e) => {
              builder.updatePhase(phase.tempId, { name: e.target.value });
            }}
          />
        </Field>
        <Field label="Duración en días (opcional)">
          <input
            type="number"
            min={1}
            className={inputCls}
            value={phase.duration_days}
            onChange={(e) => {
              builder.updatePhase(phase.tempId, { duration_days: e.target.value });
            }}
            placeholder="p. ej. 15"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Inicio (opcional)">
            <input
              type="date"
              className={inputCls}
              value={phase.start_date}
              onChange={(e) => {
                builder.updatePhase(phase.tempId, { start_date: e.target.value });
              }}
            />
          </Field>
          <Field label="Fin (opcional)">
            <input
              type="date"
              className={inputCls}
              value={phase.end_date}
              onChange={(e) => {
                builder.updatePhase(phase.tempId, { end_date: e.target.value });
              }}
            />
          </Field>
        </div>
      </div>
    );
  }

  // node
  const node = builder.nodes.find((n) => n.tempId === selected.id);
  if (!node) {
    return null;
  }
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Elemento</h3>
      <Field label="Tipo">
        <select
          className={inputCls}
          value={node.node_type}
          onChange={(e) => {
            builder.updateNode(node.tempId, { node_type: e.target.value as NodeType });
          }}
        >
          {NODE_TYPES.map((t) => (
            <option key={t} value={t}>
              {NODE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Etiqueta personalizada (opcional)">
        <input
          className={inputCls}
          value={node.type_label}
          onChange={(e) => {
            builder.updateNode(node.tempId, { type_label: e.target.value });
          }}
          placeholder="Corte, Unidad..."
        />
      </Field>
      <Field label="Nombre">
        <input
          className={inputCls}
          value={node.name}
          onChange={(e) => {
            builder.updateNode(node.tempId, { name: e.target.value });
          }}
          placeholder="Curso de Python"
        />
      </Field>
      <Field label="Fecha de entrega (opcional)">
        <input
          type="date"
          className={inputCls}
          value={node.end_date}
          onChange={(e) => {
            builder.updateNode(node.tempId, { end_date: e.target.value });
          }}
        />
      </Field>
    </div>
  );
}
