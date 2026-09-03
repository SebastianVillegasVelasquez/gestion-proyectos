import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { filesApi, type CreateFolderBody } from "../api/files.api";

const key = (projectId: string) => ["project-files", projectId] as const;

export function useProjectFiles(projectId: string) {
  return useQuery({
    queryKey: key(projectId),
    queryFn: () => filesApi.tree(projectId),
    enabled: Boolean(projectId),
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

export function useUploadFile(projectId: string) {
  return useTreeMutation(projectId, (vars: { folderId: string; file: File }) =>
    filesApi.upload(projectId, vars.folderId, vars.file),
  );
}

export function useDeleteFile(projectId: string) {
  return useTreeMutation(projectId, (fileId: string) => filesApi.deleteFile(projectId, fileId));
}
