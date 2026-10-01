import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { filesApi, type CreateFolderBody } from "../api/files.api";

export const projectFilesKey = (projectId: string) => ["project-files", projectId] as const;
const key = projectFilesKey;

export function useProjectFiles(projectId: string, enabled = true) {
  return useQuery({
    queryKey: key(projectId),
    queryFn: () => filesApi.tree(projectId),
    enabled: Boolean(projectId) && enabled,
  });
}

/**
 * Toda mutación del archivador invalida el árbol entero y no un trozo: el
 * servidor devuelve permisos calculados por carpeta, así que reconstruir a
 * mano el estado local acabaría contradiciendo a la política.
 */
function useTreeMutation<TVars, TData>(projectId: string, fn: (vars: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key(projectId) });
    },
  });
}

export function useCreateFolder(projectId: string) {
  return useTreeMutation(projectId, (body: CreateFolderBody) =>
    filesApi.createFolder(projectId, body),
  );
}

export function useDeleteFolder(projectId: string) {
  return useTreeMutation(projectId, (folderId: string) =>
    filesApi.deleteFolder(projectId, folderId),
  );
}

export function useRenameFolder(projectId: string) {
  return useTreeMutation(projectId, (vars: { folderId: string; name: string }) =>
    filesApi.renameFolder(projectId, vars.folderId, vars.name),
  );
}

export function useMoveFolder(projectId: string) {
  return useTreeMutation(projectId, (vars: { folderId: string; parentId: string | null }) =>
    filesApi.moveFolder(projectId, vars.folderId, vars.parentId),
  );
}

export function useRenameFile(projectId: string) {
  return useTreeMutation(projectId, (vars: { fileId: string; name: string }) =>
    filesApi.renameFile(projectId, vars.fileId, vars.name),
  );
}

export function useMoveFile(projectId: string) {
  return useTreeMutation(projectId, (vars: { fileId: string; folderId: string }) =>
    filesApi.moveFile(projectId, vars.fileId, vars.folderId),
  );
}

export function useUploadFile(projectId: string) {
  return useTreeMutation(
    projectId,
    (vars: { folderId: string; file: File; onProgress?: (pct: number) => void }) =>
      filesApi.upload(projectId, vars.folderId, vars.file, { onProgress: vars.onProgress }),
  );
}

export function useDeleteFile(projectId: string) {
  return useTreeMutation(projectId, (fileId: string) => filesApi.deleteFile(projectId, fileId));
}
