import type { WorkspaceGroup } from "./types";

// ── Rich mock data — simulates a real iteration cycle ─────────────────────
// Story: Carlos uploads a Figma link (V1). Ana (líder) requests changes.
// Carlos uploads V2. Ana approves.

export const MOCK_GROUPS: WorkspaceGroup[] = [
  {
    id: "grp_dis",
    name: "Célula de Diseño Instruccional",
    description: "Responsable del diseño pedagógico y la creación de contenidos del OVA.",
    leaderId: "mbr_ana",
    createdAt: "2025-01-05T08:00:00Z",
    members: [
      {
        id: "mbr_ana",
        name: "Ana Morales",
        initials: "AM",
        avatarColor: "bg-violet-600",
        role: "lider",
      },
      {
        id: "mbr_car",
        name: "Carlos Ruiz",
        initials: "CR",
        avatarColor: "bg-blue-600",
        role: "integrante",
      },
      {
        id: "mbr_lau",
        name: "Laura Pineda",
        initials: "LP",
        avatarColor: "bg-emerald-600",
        role: "integrante",
      },
      {
        id: "mbr_die",
        name: "Diego Torres",
        initials: "DT",
        avatarColor: "bg-amber-500",
        role: "integrante",
      },
    ],
    tasks: [
      {
        id: "gt_1",
        title: "Mapear objetivos de aprendizaje",
        assigneeId: "mbr_lau",
        status: "completado",
        priority: "alta",
      },
      {
        id: "gt_2",
        title: "Diseñar mapa conceptual del módulo",
        assigneeId: "mbr_car",
        status: "en_progreso",
        priority: "alta",
      },
      {
        id: "gt_3",
        title: "Validar taxonomía de Bloom",
        assigneeId: "mbr_die",
        status: "en_progreso",
        priority: "media",
      },
      {
        id: "gt_4",
        title: "Redactar guión educativo (módulo 2)",
        assigneeId: "mbr_car",
        status: "por_hacer",
        priority: "media",
      },
      {
        id: "gt_5",
        title: "Revisión pedagógica final",
        assigneeId: "mbr_ana",
        status: "por_hacer",
        priority: "baja",
      },
    ],
    deliverables: [
      // ── Deliverable 1: completed iteration cycle ──────────────────────
      {
        id: "del_proto",
        taskTitle: "Prototipo de Interfaz — Módulo 1",
        assigneeId: "mbr_car",
        status: "aprobado",
        createdAt: "2025-01-10T10:00:00Z",
        updatedAt: "2025-01-12T11:45:00Z",
        versions: [
          {
            id: "ver_proto_1",
            versionNumber: 1,
            type: "enlace",
            url: "https://figma.com/proto/abc123/Modulo1-v1",
            uploadedBy: "mbr_car",
            uploadedAt: "2025-01-10T14:30:00Z",
            note: "Primera versión del prototipo. Incluye flujo completo del módulo 1.",
          },
          {
            id: "ver_proto_2",
            versionNumber: 2,
            type: "enlace",
            url: "https://figma.com/proto/abc456/Modulo1-v2",
            uploadedBy: "mbr_car",
            uploadedAt: "2025-01-12T10:15:00Z",
            note: "V2: tipografías corregidas con el sistema de diseño. Headings ajustados a Inter/600.",
          },
        ],
        comments: [
          {
            id: "cmt_p1",
            authorId: "mbr_car",
            content: "Adjunto el prototipo inicial en Figma para revisión del líder.",
            createdAt: "2025-01-10T14:35:00Z",
            type: "comentario",
            mentions: [],
          },
          {
            id: "cmt_p2",
            authorId: "mbr_lau",
            content:
              "Se ve muy limpio. ¿Consideraron el estado vacío cuando no hay contenido cargado?",
            createdAt: "2025-01-11T08:50:00Z",
            type: "comentario",
            mentions: ["mbr_car"],
          },
          {
            id: "cmt_p3",
            authorId: "mbr_ana",
            content:
              "@Carlos Ruiz las tipografías en los headings no siguen el sistema de diseño establecido. Por favor revisa la guía de estilos y usa Inter semibold 600. El cuerpo de texto también debe ir en 14px/1.5.",
            createdAt: "2025-01-11T09:20:00Z",
            type: "solicitud_cambio",
            mentions: ["mbr_car"],
          },
          {
            id: "cmt_p4",
            authorId: "mbr_car",
            content:
              "Correcciones aplicadas. Subí la Versión 2 con todos los ajustes tipográficos. El estado vacío también fue añadido.",
            createdAt: "2025-01-12T10:20:00Z",
            type: "comentario",
            mentions: [],
          },
          {
            id: "cmt_p5",
            authorId: "mbr_ana",
            content:
              "Excelente trabajo @Carlos Ruiz. Los cambios se aplicaron correctamente y el flujo se siente consistente con el sistema. Prototipo aprobado.",
            createdAt: "2025-01-12T11:45:00Z",
            type: "aprobacion",
            mentions: ["mbr_car"],
          },
        ],
      },

      // ── Deliverable 2: in review ──────────────────────────────────────
      {
        id: "del_guion",
        taskTitle: "Guión Educativo — Módulo 2",
        assigneeId: "mbr_lau",
        status: "en_revision",
        createdAt: "2025-01-13T09:00:00Z",
        updatedAt: "2025-01-15T16:00:00Z",
        versions: [
          {
            id: "ver_guion_1",
            versionNumber: 1,
            type: "archivo",
            url: "#",
            fileName: "Guion_Educativo_Modulo2_v1.docx",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            uploadedBy: "mbr_lau",
            uploadedAt: "2025-01-15T16:00:00Z",
            note: "Primera versión del guión. Cubre objetivos, contenidos y actividades del módulo 2.",
          },
        ],
        comments: [
          {
            id: "cmt_g1",
            authorId: "mbr_lau",
            content:
              "Guión listo para revisión. Incluye el mapa de actividades y los criterios de evaluación. @Ana Morales quedo pendiente de tu feedback.",
            createdAt: "2025-01-15T16:05:00Z",
            type: "comentario",
            mentions: ["mbr_ana"],
          },
        ],
      },

      // ── Deliverable 3: draft, no versions yet ─────────────────────────
      {
        id: "del_media",
        taskTitle: "Recursos Multimedia — Módulo 1",
        assigneeId: "mbr_die",
        status: "borrador",
        createdAt: "2025-01-16T10:00:00Z",
        updatedAt: "2025-01-16T10:00:00Z",
        versions: [],
        comments: [
          {
            id: "cmt_m1",
            authorId: "mbr_die",
            content:
              "Iniciando recolección de recursos. Voy a revisar las licencias Creative Commons antes de adjuntar. ETA: 3 días.",
            createdAt: "2025-01-16T10:05:00Z",
            type: "comentario",
            mentions: [],
          },
        ],
      },
    ],
  },

  // ── Group 2 ───────────────────────────────────────────────────────────────
  {
    id: "grp_dev",
    name: "Célula de Desarrollo Web",
    description: "Construcción e integración técnica de los módulos del OVA en plataforma.",
    leaderId: "mbr_sof",
    createdAt: "2025-01-06T08:00:00Z",
    members: [
      {
        id: "mbr_sof",
        name: "Sofía Blanco",
        initials: "SB",
        avatarColor: "bg-rose-600",
        role: "lider",
      },
      {
        id: "mbr_jua",
        name: "Juan Pérez",
        initials: "JP",
        avatarColor: "bg-cyan-600",
        role: "integrante",
      },
      {
        id: "mbr_man",
        name: "Manuela Ossa",
        initials: "MO",
        avatarColor: "bg-indigo-600",
        role: "integrante",
      },
    ],
    tasks: [
      {
        id: "gt_d1",
        title: "Setup entorno de desarrollo",
        assigneeId: "mbr_jua",
        status: "completado",
        priority: "alta",
      },
      {
        id: "gt_d2",
        title: "Implementar componente de quiz",
        assigneeId: "mbr_man",
        status: "en_progreso",
        priority: "alta",
      },
      {
        id: "gt_d3",
        title: "Integración con LMS (SCORM)",
        assigneeId: "mbr_sof",
        status: "por_hacer",
        priority: "media",
      },
    ],
    deliverables: [
      {
        id: "del_comp",
        taskTitle: "Componentes Frontend — Quiz Interactivo",
        assigneeId: "mbr_man",
        status: "cambios_solicitados",
        createdAt: "2025-01-14T09:00:00Z",
        updatedAt: "2025-01-17T14:00:00Z",
        versions: [
          {
            id: "ver_comp_1",
            versionNumber: 1,
            type: "enlace",
            url: "https://github.com/org/ova-quiz/pull/12",
            uploadedBy: "mbr_man",
            uploadedAt: "2025-01-17T14:00:00Z",
            note: "PR con los componentes del quiz. Incluye 4 tipos de pregunta.",
          },
        ],
        comments: [
          {
            id: "cmt_c1",
            authorId: "mbr_man",
            content:
              "PR listo para review. Los componentes de selección múltiple y verdadero/falso están cubiertos con tests.",
            createdAt: "2025-01-17T14:05:00Z",
            type: "comentario",
            mentions: ["mbr_sof"],
          },
          {
            id: "cmt_c2",
            authorId: "mbr_sof",
            content:
              "@Manuela Ossa hay un problema de accesibilidad: los inputs de radio no tienen aria-label. Además la animación de feedback correcto/incorrecto es demasiado agresiva. Ajusta antes de hacer merge.",
            createdAt: "2025-01-17T16:30:00Z",
            type: "solicitud_cambio",
            mentions: ["mbr_man"],
          },
        ],
      },
      {
        id: "del_api",
        taskTitle: "Documentación API — Módulo de Progreso",
        assigneeId: "mbr_jua",
        status: "borrador",
        createdAt: "2025-01-18T08:00:00Z",
        updatedAt: "2025-01-18T08:00:00Z",
        versions: [],
        comments: [],
      },
    ],
  },
];
