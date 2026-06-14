import { useState, useEffect, useRef } from "react";
import { X, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectMember, ProjectRole } from "../types";
import { PROJECT_ROLE_OPTIONS, AVATAR_COLORS } from "../types";

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500";
const labelCls =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400";

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

interface AddMemberModalProps {
  existingCount: number;
  onAdd: (member: ProjectMember) => void;
  onClose: () => void;
}

export function AddMemberModal({ existingCount, onAdd, onClose }: AddMemberModalProps) {
  const [name, setName] = useState("");
  const [initials, setInitials] = useState("");
  const [role, setRole] = useState<ProjectRole>("integrante");
  const [color, setColor] = useState(AVATAR_COLORS[existingCount % AVATAR_COLORS.length]);
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  // Auto-focus name input on open
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Auto-compute initials from name
  useEffect(() => {
    setInitials(getInitials(name));
  }, [name]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
    };
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      nameRef.current?.focus();
      return;
    }
    onAdd({
      id: crypto.randomUUID(),
      name: name.trim(),
      initials: initials || getInitials(name.trim()) || "?",
      role,
      avatarColor: color,
    });
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-member-title"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <UserPlus className="size-4 text-blue-600 dark:text-blue-400" />
            <h2
              id="add-member-title"
              className="text-sm font-semibold text-slate-900 dark:text-slate-50"
            >
              Añadir miembro
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
          {/* Name */}
          <div>
            <label className={labelCls}>Nombre completo *</label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder="Ej: Laura Gómez"
              className={cn(
                inputCls,
                error && "border-red-400 focus:border-red-500 focus:ring-red-500/30",
              )}
            />
            {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
          </div>

          {/* Initials + Role side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Iniciales</label>
              <input
                type="text"
                value={initials}
                onChange={(e) => {
                  setInitials(e.target.value.slice(0, 3).toUpperCase());
                }}
                placeholder="LG"
                maxLength={3}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Rol</label>
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as ProjectRole);
                }}
                className={inputCls}
              >
                {PROJECT_ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Avatar color */}
          <div>
            <label className={labelCls}>Color del avatar</label>
            <div className="flex items-center gap-2">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setColor(c);
                  }}
                  aria-label={c}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold text-white transition-transform duration-150",
                    c,
                    color === c
                      ? "ring-2 ring-blue-500 ring-offset-2 scale-110 dark:ring-offset-slate-900"
                      : "hover:scale-105",
                  )}
                >
                  {initials || "?"}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:hover:bg-blue-500"
            >
              Añadir miembro
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
