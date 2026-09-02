import { useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Download,
  Sparkles,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/get-error-message";
import type { BulkCreateUsersResult } from "../../api/users.api";
import { useBulkCreateUsers } from "../../hooks/use-admin-users";
import { parseUsersCsv, type ParsedUsersCsv } from "../../utils/parse-users-csv";
import {
  copyTextToClipboard,
  downloadCsvTemplate,
  USERS_CSV_LLM_PROMPT,
} from "../../utils/bulk-upload-helpers";

// Columnas que mostramos en la previsualización, en el orden esperado del CSV.
const CSV_PREVIEW_COLUMNS: { key: string; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "nombre", label: "Nombre" },
  { key: "apellido", label: "Apellido" },
  { key: "cedula", label: "Cédula" },
  { key: "cargo", label: "Cargo" },
];

// Mensajes de fila que en realidad no son un error del archivo, sino un aviso
// esperado: la persona ya existe en el sistema (por correo o documento). Los
// distinguimos en la UI para que el admin no los lea como "algo salió mal".
const ALREADY_EXISTS_PATTERN = /ya se encuentra registrado|ya está registrad/i;

// ── Modal: carga masiva desde CSV ───────────────────────────────────────────
export function BulkUploadModal({ onClose }: { onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedUsersCsv | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const bulkCreate = useBulkCreateUsers();
  const [result, setResult] = useState<BulkCreateUsersResult | null>(null);

  // Una vez hay un archivo cargado (previsualizado o ya procesado), dejamos de
  // mostrar las instrucciones: solo estorban y le quitan espacio a la tabla.
  const showInstructions = !preview && !result;

  const handleCopyPrompt = () => {
    copyTextToClipboard(USERS_CSV_LLM_PROMPT)
      .then(() => {
        setPromptCopied(true);
        setTimeout(() => {
          setPromptCopied(false);
        }, 1500);
      })
      .catch(() => {
        setParseError("No se pudo copiar el prompt al portapapeles.");
      });
  };

  const processFile = (selected: File) => {
    setResult(null);
    setParseError(null);
    setFileName(selected.name);
    setFile(selected);

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const parsed = parseUsersCsv(text);
      if (parsed.rows.length === 0) {
        setPreview(null);
        setParseError("El archivo no tiene filas para previsualizar.");
        return;
      }
      setPreview(parsed);
    };
    reader.onerror = () => {
      setPreview(null);
      setParseError("No se pudo leer el archivo.");
    };
    reader.readAsText(selected);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      processFile(selected);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      processFile(dropped);
    }
  };

  const handleReset = () => {
    setFile(null);
    setFileName(null);
    setPreview(null);
    setParseError(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = () => {
    if (!file) {
      return;
    }
    bulkCreate.mutate(file, { onSuccess: setResult });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Cargar usuarios desde CSV"
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Upload className="size-4 text-brand-gold" /> Cargar usuarios desde CSV
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 px-5 py-4">
          {showInstructions && (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-accent/40 p-4">
              <p className="text-sm font-medium text-foreground">¿Cómo armo el archivo?</p>
              <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                <li>
                  De cada persona necesitamos al menos su{" "}
                  <span className="text-foreground">correo, nombre y apellido</span>.
                </li>
                <li>
                  Si quieres, también puedes agregar su{" "}
                  <span className="text-foreground">cédula, cargo y una contraseña</span> — si dejas
                  la contraseña en blanco, le asignamos una temporal automáticamente.
                </li>
                <li>Un renglón por persona.</li>
                <li>
                  ¿El cargo que escribiste no existe todavía en el sistema? No te preocupes, lo
                  creamos automáticamente.
                </li>
                <li>
                  Si alguien ya está registrado (o aparece dos veces en el archivo), te lo avisamos
                  sin detener la carga del resto.
                </li>
                <li>
                  Puedes armar el archivo en Excel o Google Sheets y luego guardarlo/exportarlo como
                  CSV.
                </li>
              </ul>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={downloadCsvTemplate}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                >
                  <Download className="size-3.5" /> Descargar plantilla
                </button>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                >
                  {promptCopied ? (
                    <Check className="size-3.5 text-green-600 dark:text-green-400" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  {promptCopied ? "Prompt copiado" : "Copiar prompt para IA"}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Ese prompt le explica a cualquier IA (ChatGPT, Claude, etc.) cómo armar el archivo
                por ti: solo pégale la lista de personas que quieres cargar.
              </p>
            </div>
          )}

          {showInstructions && (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
              aria-label="Arrastra o selecciona tu archivo CSV"
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition",
                isDragging
                  ? "border-brand-gold bg-brand-gold/5"
                  : "border-border hover:border-brand-gold/60 hover:bg-accent/40",
              )}
            >
              <Upload className="size-6 text-muted-foreground" />
              <p className="text-sm text-foreground">
                Arrastra tu archivo aquí o{" "}
                <span className="font-medium text-brand-gold">haz clic para buscarlo</span>
              </p>
              <p className="text-xs text-muted-foreground">Solo archivos .csv</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                aria-label="Archivo CSV"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}

          {parseError && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {parseError}
            </p>
          )}

          {preview && !result && (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {fileName}: {preview.rows.length} usuario
                  {preview.rows.length !== 1 ? "s" : ""} para cargar.
                </p>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Elegir otro archivo
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-accent text-muted-foreground">
                    <tr>
                      {CSV_PREVIEW_COLUMNS.filter((c) => preview.headers.includes(c.key)).map(
                        (c) => (
                          <th key={c.key} className="px-3 py-2 font-medium">
                            {c.label}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, index) => (
                      <tr key={index} className="border-t border-border">
                        {CSV_PREVIEW_COLUMNS.filter((c) => preview.headers.includes(c.key)).map(
                          (c) => (
                            <td key={c.key} className="px-3 py-1.5 text-foreground">
                              {row[c.key] || "—"}
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={handleUpload}
                disabled={bulkCreate.isPending}
                className="self-start rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-brand-gold-dark disabled:opacity-60"
              >
                {bulkCreate.isPending
                  ? "Cargando…"
                  : `Cargar ${preview.rows.length} usuario${preview.rows.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          )}
          {bulkCreate.isError && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {getErrorMessage(bulkCreate.error, "No se pudo procesar el archivo")}
            </p>
          )}
          {result && (
            <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-lg border border-border bg-background p-3 text-sm">
              {(() => {
                const alreadyExisted = result.failed.filter((f) =>
                  ALREADY_EXISTS_PATTERN.test(f.error),
                );
                const realErrors = result.failed.filter(
                  (f) => !ALREADY_EXISTS_PATTERN.test(f.error),
                );
                return (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="flex items-center gap-1.5 font-medium text-foreground">
                          <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
                          {result.created.length} de {result.total_rows} usuarios creados
                        </p>
                        {alreadyExisted.length > 0 && (
                          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                            <AlertCircle className="size-3.5" />
                            {alreadyExisted.length} ya existían
                          </p>
                        )}
                        {realErrors.length > 0 && (
                          <p className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                            <XCircle className="size-3.5" />
                            {realErrors.length} con error
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleReset}
                        className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      >
                        Cargar otro archivo
                      </button>
                    </div>
                    {result.created.length > 0 && (
                      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border">
                        <table className="w-full text-left text-xs">
                          <thead className="sticky top-0 bg-accent text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2 font-medium">Nombre</th>
                              <th className="px-3 py-2 font-medium">Apellido</th>
                              <th className="px-3 py-2 font-medium">Email</th>
                              <th className="px-3 py-2 font-medium">Acceso</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.created.map((u) => (
                              <tr key={u.id} className="border-t border-border">
                                <td className="px-3 py-1.5 text-foreground">{u.name}</td>
                                <td className="px-3 py-1.5 text-foreground">{u.last_name}</td>
                                <td className="px-3 py-1.5 text-foreground">{u.email}</td>
                                <td className="px-3 py-1.5 text-muted-foreground">
                                  {u.temporary_password ??
                                    "Enlace de activación enviado por correo"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {alreadyExisted.length > 0 && (
                      <ul className="max-h-32 shrink-0 space-y-1 overflow-y-auto text-xs text-amber-600 dark:text-amber-400">
                        {alreadyExisted.map((f) => (
                          <li key={f.row} className="flex items-start gap-1.5">
                            <AlertCircle className="mt-0.5 size-3 shrink-0" />
                            Fila {f.row} ({f.email ?? "sin correo"}): {f.error}
                          </li>
                        ))}
                      </ul>
                    )}
                    {realErrors.length > 0 && (
                      <ul className="max-h-32 shrink-0 space-y-1 overflow-y-auto text-xs text-red-600 dark:text-red-400">
                        {realErrors.map((f) => (
                          <li key={f.row} className="flex items-start gap-1.5">
                            <XCircle className="mt-0.5 size-3 shrink-0" />
                            Fila {f.row} ({f.email ?? "sin correo"}): {f.error}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition hover:bg-accent"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
