import { useContext } from "react";
import {
  ActiveProjectContext,
  type ActiveProjectContextValue,
} from "../context/active-project-context";

const NO_SCOPE: ActiveProjectContextValue = { projectId: null, setProjectId: () => undefined };

/** Proyecto activo. Fuera del proveedor (tests, rutas públicas) equivale a «todos». */
export function useActiveProject(): ActiveProjectContextValue {
  return useContext(ActiveProjectContext) ?? NO_SCOPE;
}
