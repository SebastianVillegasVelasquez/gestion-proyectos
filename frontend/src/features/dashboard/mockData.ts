import type {
  Comment,
  DashboardHeaderData,
  Deadline,
  KpiCard,
  Project,
  Task,
} from "./types";

export const mockHeaderData: DashboardHeaderData = {
  name: "Ana García",
  date: "miércoles, 11 de junio de 2025",
  tasksToday: 5,
  tasksTodayTotal: 8,
};

export const mockKpiCards: KpiCard[] = [
  {
    id: "kpi-1",
    label: "PROYECTOS ACTIVOS",
    value: 12,
    subtitle: "+2 este mes",
    accentColor: "blue",
  },
  {
    id: "kpi-2",
    label: "TAREAS COMPLETADAS",
    value: 84,
    subtitle: "de 120 totales",
    accentColor: "emerald",
  },
  {
    id: "kpi-3",
    label: "EN REVISIÓN",
    value: 7,
    subtitle: "requieren atención",
    accentColor: "amber",
  },
  {
    id: "kpi-4",
    label: "VENCIDAS",
    value: 3,
    subtitle: "desde la semana pasada",
    accentColor: "red",
  },
];

export const mockTasks: Task[] = [
  // Pending
  {
    id: "task-1",
    title: "Diseñar wireframes de la pantalla de perfil",
    status: "pending",
    tags: [
      { label: "OBJ Digital", variant: "project" },
      { label: "Jun 14", variant: "date" },
    ],
  },
  {
    id: "task-2",
    title: "Revisar requerimientos del módulo de pagos",
    status: "pending",
    tags: [
      { label: "Fintech", variant: "project" },
      { label: "Jun 16", variant: "date" },
    ],
  },
  {
    id: "task-3",
    title: "Configurar entorno de staging",
    status: "pending",
    tags: [
      { label: "DevOps", variant: "project" },
      { label: "Jun 18", variant: "date" },
    ],
  },
  // In progress
  {
    id: "task-4",
    title: "Implementar autenticación JWT",
    status: "in-progress",
    tags: [
      { label: "Backend API", variant: "project" },
      { label: "Jun 12", variant: "date" },
    ],
  },
  {
    id: "task-5",
    title: "Integrar componentes del dashboard",
    status: "in-progress",
    tags: [
      { label: "OBJ Digital", variant: "project" },
      { label: "Jun 13", variant: "date" },
    ],
  },
  {
    id: "task-6",
    title: "Optimizar queries de la base de datos",
    status: "in-progress",
    tags: [
      { label: "Backend API", variant: "project" },
      { label: "Jun 15", variant: "date" },
    ],
  },
  // Completed
  {
    id: "task-7",
    title: "Configurar pipeline de CI/CD",
    status: "completed",
    tags: [
      { label: "DevOps", variant: "project" },
      { label: "Jun 08", variant: "date" },
    ],
  },
  {
    id: "task-8",
    title: "Documentar API REST endpoints",
    status: "completed",
    tags: [
      { label: "Backend API", variant: "project" },
      { label: "Jun 10", variant: "date" },
    ],
  },
];

export const mockProjects: Project[] = [
  {
    id: "proj-1",
    name: "OBJ Digital",
    techBadge: "Frontend",
    status: "active",
    coordinator: "Ana García",
    tasksTotal: 24,
    tasksCompleted: 18,
    progressPercent: 75,
  },
  {
    id: "proj-2",
    name: "Backend API",
    techBadge: "Backend",
    status: "active",
    coordinator: "Carlos López",
    tasksTotal: 18,
    tasksCompleted: 9,
    progressPercent: 50,
  },
  {
    id: "proj-3",
    name: "Fintech Module",
    techBadge: "Backend",
    status: "at-risk",
    coordinator: "María Torres",
    tasksTotal: 15,
    tasksCompleted: 4,
    progressPercent: 27,
  },
  {
    id: "proj-4",
    name: "DevOps Pipeline",
    techBadge: "DevOps",
    status: "in-review",
    coordinator: "Juan Martínez",
    tasksTotal: 12,
    tasksCompleted: 7,
    progressPercent: 58,
  },
];

export const mockDeadlines: Deadline[] = [
  {
    id: "dl-1",
    day: 11,
    month: "Jun",
    title: "Entrega de diseños de interfaz",
    project: "OBJ Digital",
    priority: "today",
  },
  {
    id: "dl-2",
    day: 12,
    month: "Jun",
    title: "Revisión de seguridad del módulo de auth",
    project: "Backend API",
    priority: "high",
  },
  {
    id: "dl-3",
    day: 14,
    month: "Jun",
    title: "Demo con equipo de producto",
    project: "OBJ Digital",
    priority: "medium",
  },
  {
    id: "dl-4",
    day: 16,
    month: "Jun",
    title: "Revisión de arquitectura de microservicios",
    project: "Backend API",
    priority: "medium",
  },
  {
    id: "dl-5",
    day: 18,
    month: "Jun",
    title: "Entrega de informe mensual",
    project: "Fintech Module",
    priority: "low",
  },
];

export const mockComments: Comment[] = [
  {
    id: "cmt-1",
    authorInitials: "AG",
    authorColor: "bg-violet-600",
    authorName: "Ana García",
    timestamp: "hace 15 min",
    text: "@Carlos, ¿puedes revisar el PR de los componentes del dashboard? Hay un problema con el estado global.",
    mentions: ["Carlos"],
    project: "OBJ Digital",
    section: "Frontend",
    isUnread: true,
  },
  {
    id: "cmt-2",
    authorInitials: "CL",
    authorColor: "bg-blue-600",
    authorName: "Carlos López",
    timestamp: "hace 1h",
    text: "@Ana actualicé los endpoints del API. Revisa la documentación actualizada en el repositorio.",
    mentions: ["Ana"],
    project: "Backend API",
    section: "Documentación",
    isUnread: true,
  },
  {
    id: "cmt-3",
    authorInitials: "MT",
    authorColor: "bg-emerald-600",
    authorName: "María Torres",
    timestamp: "hace 2h",
    text: "El módulo de pagos tiene un bug crítico. @Juan necesitamos hacer rollback del último despliegue.",
    mentions: ["Juan"],
    project: "Fintech Module",
    section: "Pagos",
    isUnread: false,
  },
  {
    id: "cmt-4",
    authorInitials: "JM",
    authorColor: "bg-amber-600",
    authorName: "Juan Martínez",
    timestamp: "hace 3h",
    text: "Pipeline de CI/CD listo. @María y @Carlos por favor validen el ambiente de staging.",
    mentions: ["María", "Carlos"],
    project: "DevOps Pipeline",
    section: "CI/CD",
    isUnread: false,
  },
];
