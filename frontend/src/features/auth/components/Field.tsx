import { forwardRef } from "react";

interface FieldProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  error?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(
  ({ id, label, placeholder, value, error, onChange, onBlur }, ref) => {
    return (
      <div>
        <label
          htmlFor={id}
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={id}
          name={id}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`w-full rounded-lg border bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-4 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-900 ${
            error
              ? "border-red-400 focus:border-red-500 focus:ring-red-100 dark:border-red-500/60 dark:focus:ring-red-500/20"
              : "border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-blue-100 dark:border-slate-700 dark:hover:border-slate-600 dark:focus:border-blue-500 dark:focus:ring-blue-500/20"
          }`}
        />
        {error && (
          <p
            id={`${id}-error`}
            role="alert"
            className="mt-1.5 text-xs text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}
      </div>
    );
  },
);

Field.displayName = "Field";
