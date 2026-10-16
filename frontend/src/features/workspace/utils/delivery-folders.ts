import type { ApiProjectFolder } from "@/features/files/api/files.api";
import type { DeliveryFolderOption } from "../components/DeliverableDetailView";

/** Subcarpetas (recursivas) de una carpeta, para el selector de destino al
 *  entregar un archivo. La carpeta en sí NO se incluye: es la opción «por
 *  defecto» del selector. */
export function flattenSubfolders(folder: ApiProjectFolder, depth = 0): DeliveryFolderOption[] {
  const prefix = depth > 0 ? "— ".repeat(depth) : "";
  return folder.children.flatMap((child) => [
    { id: child.id, label: `${prefix}${child.name}` },
    ...flattenSubfolders(child, depth + 1),
  ]);
}

/** Opciones de destino dentro de la carpeta de un equipo (vacío si aún no existe). */
export function teamFolderOptions(
  root: ApiProjectFolder | undefined,
  teamId: string | null,
): DeliveryFolderOption[] {
  if (!root || !teamId) {
    return [];
  }
  const teamFolder = root.children.find((f) => f.team_id === teamId);
  return teamFolder ? flattenSubfolders(teamFolder) : [];
}
