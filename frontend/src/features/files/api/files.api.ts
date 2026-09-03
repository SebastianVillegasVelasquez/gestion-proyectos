import http from "@/lib/http";

/** Un archivo guardado en una carpeta del proyecto. */
export interface ApiProjectFile {
  id: string;
  folder_id: string;
  name: string;
  content_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  created_at: string;
}

/** Carpeta del archivador, con sus hijas y sus archivos ya anidados. */
export interface ApiProjectFolder {
  id: string;
  parent_id: string | null;
  name: string;
  team_id: string | null;
  team_name: string | null;
  is_root: boolean;
  /** Permiso ya resuelto por el servidor para ESTA carpeta. La UI no vuelve a
   *  deducir la política: la muestra. */
  can_write: boolean;
  created_at: string;
  children: ApiProjectFolder[];
  files: ApiProjectFile[];
}

export interface ApiProjectFiles {
  project_id: string;
  root: ApiProjectFolder;
  /** Equipos que aún no tienen carpeta y que el usuario podría abrir. */
  teams_without_folder: { id: string; name: string }[];
}

export interface CreateFolderBody {
  name: string;
  parent_id?: string | null;
  team_id?: string | null;
}

const base = (projectId: string) => `/projects/${projectId}/files`;

export const filesApi = {
  tree: (projectId: string) => http.get<ApiProjectFiles>(base(projectId)).then((r) => r.data),

  createFolder: (projectId: string, body: CreateFolderBody) =>
    http.post<ApiProjectFolder>(`${base(projectId)}/folders`, body).then((r) => r.data),

  deleteFolder: (projectId: string, folderId: string) =>
    http.delete(`${base(projectId)}/folders/${folderId}`).then(() => undefined),

  upload: (projectId: string, folderId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return http
      .post<ApiProjectFile>(`${base(projectId)}/folders/${folderId}/upload`, form, {
        // Subir puede tardar bastante más que una llamada normal: el timeout
        // global (10 s) cortaría archivos grandes a media transferencia.
        timeout: 120_000,
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  deleteFile: (projectId: string, fileId: string) =>
    http.delete(`${base(projectId)}/${fileId}`).then(() => undefined),

  /**
   * Descarga con la sesión puesta. Un `<a href>` normal no llevaría el token,
   * así que se pide como blob y se dispara la descarga desde el navegador.
   */
  download: async (projectId: string, file: ApiProjectFile) => {
    const response = await http.get<Blob>(`${base(projectId)}/${file.id}/download`, {
      responseType: "blob",
      timeout: 120_000,
    });
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    URL.revokeObjectURL(url);
  },
};
