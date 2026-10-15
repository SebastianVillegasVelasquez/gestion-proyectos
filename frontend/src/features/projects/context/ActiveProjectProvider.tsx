import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ActiveProjectContext } from "./active-project-context";

const KEY = "obj-active-project";

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Recuerda, por navegador, el proyecto con el que se está trabajando. */
export function ActiveProjectProvider({ children }: { children: ReactNode }) {
  const [projectId, setState] = useState<string | null>(read);

  const setProjectId = useCallback((id: string | null) => {
    try {
      if (id) {
        localStorage.setItem(KEY, id);
      } else {
        localStorage.removeItem(KEY);
      }
    } catch {
      // Sin almacenamiento la elección dura lo que dure la pestaña.
    }
    setState(id);
  }, []);

  const value = useMemo(() => ({ projectId, setProjectId }), [projectId, setProjectId]);
  return <ActiveProjectContext.Provider value={value}>{children}</ActiveProjectContext.Provider>;
}
