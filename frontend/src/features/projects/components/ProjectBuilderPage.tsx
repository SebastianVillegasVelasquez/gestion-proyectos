import { useOutletContext } from "react-router";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import { ProjectBuilderLayout } from "./ProjectBuilderLayout";

export function ProjectBuilderPage() {
  const { dark, toggleDark } = useOutletContext<AppOutletContext>();
  return <ProjectBuilderLayout dark={dark} onToggleDark={toggleDark} />;
}
