import { useState } from "react";
import { useNavigate } from "react-router";
import type { StoredProject } from "../context/ProjectsContext";
import { useProjectsContext } from "../context/ProjectsContext";
import type { ProjectMember } from "../types";
import { ProjectHeader } from "./ProjectHeader";
import { ActionBar } from "./ActionBar";
import { StatsGrid } from "./StatsGrid";
import { StructurePreview } from "./StructurePreview";
import { TeamList } from "./TeamList";
import { AddMemberModal } from "./AddMemberModal";

interface ProjectDetailDashboardProps {
  stored: StoredProject;
  dark: boolean;
  onToggleDark: () => void;
}

export function ProjectDetailDashboard({
  stored,
  dark,
  onToggleDark,
}: ProjectDetailDashboardProps) {
  const navigate = useNavigate();
  const { setActiveProjectId, addMember, removeMember } = useProjectsContext();
  const [showAddMember, setShowAddMember] = useState(false);

  const handleEdit = () => {
    setActiveProjectId(stored.id);
    navigate("/projects/builder");
  };

  const handleAddMember = (member: ProjectMember) => {
    addMember(stored.id, member);
    setShowAddMember(false);
  };

  const handleManageTasks = () => {
    navigate(`/projects/${stored.id}/gantt`);
  };

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5 lg:h-full lg:overflow-hidden">
      {/* Encabezado del proyecto */}
      <ProjectHeader
        project={stored.project}
        dark={dark}
        onToggleDark={onToggleDark}
      />

      {/* Barra de acciones */}
      <ActionBar
        onEdit={handleEdit}
        onAddMembers={() => { setShowAddMember(true); }}
        onManageTasks={handleManageTasks}
      />

      {/* KPI cards */}
      <StatsGrid
        project={stored.project}
        nodes={stored.nodes}
        members={stored.members}
      />

      {/* Split: estructura (60%) + equipo (40%) */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <div className="flex min-h-64 min-w-0 flex-col lg:flex-[3]">
          <StructurePreview nodes={stored.nodes} />
        </div>
        <div className="flex min-h-64 min-w-0 flex-col lg:flex-[2]">
          <TeamList
            members={stored.members}
            onRemove={(id) => { removeMember(stored.id, id); }}
          />
        </div>
      </div>

      {/* Modal añadir miembro */}
      {showAddMember && (
        <AddMemberModal
          existingCount={stored.members.length}
          onAdd={handleAddMember}
          onClose={() => { setShowAddMember(false); }}
        />
      )}
    </div>
  );
}
