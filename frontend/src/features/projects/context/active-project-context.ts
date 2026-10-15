import { createContext } from "react";

export interface ActiveProjectContextValue {
  /** Proyecto que acota las vistas (equipos, «Mis tareas»…); null = todos. */
  projectId: string | null;
  setProjectId: (id: string | null) => void;
}

export const ActiveProjectContext = createContext<ActiveProjectContextValue | null>(null);
