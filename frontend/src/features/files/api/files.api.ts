import http from "@/lib/http";

/** De qué entrega del espacio de trabajo salió un archivo. */
export interface ApiFileDelivery {
  deliverable_id: string;
  task_title: string;
  version_number: number;
  /** Título/detalle que puso quien entregó. */
  note: string | null;
  /** Instrucciones para el siguiente rol. Interno del equipo. */
  observations: string | null;
}

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
  /** Presente solo si el archivo llegó por una entrega (V1, V2…). */
  delivery: ApiFileDelivery | null;
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
  /** `true` = se está viendo el archivador COMPLETO (administración,
   *  coordinación o supervisión). `false` = recortado a los equipos de quien
   *  mira, y la vista lo dice para no dar a entender que no hay más. */
  sees_whole_project: boolean;
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
  download: async (projectId: string, fileId: string, fileName: string) => {
    const blob = await filesApi.blob(projectId, fileId, "download");
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  },

  /**
   * El contenido del archivo como blob. Mismo motivo que la descarga: la ruta
   * está autenticada, así que el navegador no puede pedirla por su cuenta desde
   * un `src`; se trae con la sesión y se le da al `<img>`/`<iframe>` una URL de
   * objeto local.
   *
   * `download` fuerza la descarga y `view` pide al servidor la cabecera
   * `inline`, que es la que hace que un PDF se muestre en vez de bajarse.
   */
  blob: (projectId: string, fileId: string, mode: "view" | "download") =>
    http
      .get<Blob>(`${base(projectId)}/${fileId}/${mode}`, {
        responseType: "blob",
        timeout: 120_000,
      })
      .then((r) => r.data),
};
