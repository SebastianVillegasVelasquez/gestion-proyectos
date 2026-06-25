import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Mensaje claro y específico para el usuario cuando algo falla. */
  fallbackTitle?: string;
  fallbackHint?: string;
}

interface State {
  hasError: boolean;
}

/**
 * Frontera de errores: evita que una excepción de render tumbe toda la app.
 * Aísla la sección envuelta y muestra un mensaje accionable con opción de
 * reintentar, en lugar de una pantalla en blanco.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Punto único para enviar el error a un servicio de monitoreo más adelante.
    console.error("ErrorBoundary atrapó un error:", error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const title = this.props.fallbackTitle ?? "Algo salió mal";
    const hint =
      this.props.fallbackHint ??
      "Ocurrió un error inesperado al mostrar esta sección. Puedes reintentar.";

    return (
      <div
        role="alert"
        className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/40">
          <AlertTriangle className="size-7 text-red-500" />
        </div>
        <div className="max-w-sm">
          <p className="font-semibold text-slate-800 dark:text-slate-200">{title}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</p>
        </div>
        <button
          type="button"
          onClick={this.handleRetry}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RotateCcw className="size-3.5" /> Reintentar
        </button>
      </div>
    );
  }
}
