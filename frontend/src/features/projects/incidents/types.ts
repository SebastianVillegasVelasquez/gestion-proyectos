export type IncidentResponsible = "cliente" | "equipo" | "tercero";

export interface IncidentAttachment {
  id: string;
  name: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}

export interface ProjectIncident {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  email_body: string | null;
  responsible: IncidentResponsible;
  /** Cuándo ocurrió (YYYY-MM-DD): el dato principal de la bitácora. */
  incident_date: string;
  /** Días que el incidente atrasó o impactó al proyecto. */
  impact_days: number;
  /** Cuándo respondió el cliente; se completa después, por eso es opcional. */
  client_response_date: string | null;
  /** Días entre el incidente y la respuesta del cliente (derivado). */
  client_response_days: number | null;
  /** Días ya sumados a la fecha de fin del proyecto (null = no reflejado). */
  applied_days: number | null;
  applied_at: string | null;
  is_applied: boolean;
  author_name: string | null;
  created_at: string;
  attachments: IncidentAttachment[];
}

export interface CreateIncidentPayload {
  title: string;
  incident_date: string;
  responsible: IncidentResponsible;
  impact_days: number;
  description?: string | null;
  email_body?: string | null;
  client_response_date?: string | null;
}

/** Parche parcial: `null` en descripción, correo o respuesta del cliente los vacía. */
export type UpdateIncidentPayload = Partial<CreateIncidentPayload>;
