import type { Team } from "../../types/api.types";
import { TeamFormModal } from "../teams/TeamFormModal";

// Editar un equipo. La implementación vive en TeamFormModal (crear/editar
// comparten campos y validación); aquí solo fijamos el modo edición.
export function EditTeamModal({ team, onClose }: { team: Team; onClose: () => void }) {
  return <TeamFormModal team={team} onClose={onClose} />;
}
