import { Boxes, Crown, LifeBuoy, Rocket, UserRound } from "lucide-react";
import type { ManualSection } from "./types";

// Manual de usuario de Bitácora OBJ para quien TRABAJA en los proyectos.
// Está partido por rol —una guía para el integrante y otra para quien lidera—
// porque hacen cosas distintas con las mismas pantallas, y escrito contra el
// flujo real de la aplicación: los nombres entre `[[…]]` son los que se leen
// literalmente en pantalla.
//
// Para añadir un tema: un objeto más en `articles`. El índice lateral, la
// búsqueda y la navegación anterior/siguiente salen solos de esta estructura.

/**
 * URL del video de bienvenida. `null` mientras no esté grabado: el apartado
 * existe igualmente y muestra un aviso en lugar de un reproductor vacío.
 *
 * Admite YouTube y Vimeo (se convierte a su URL de incrustación) o el enlace
 * directo a un `.mp4`. Para publicarlo basta con pegar aquí la URL.
 */
export const MANUAL_VIDEO_URL: string | null = null;

// Las pastillas de estado se copian tal cual de la app (`STATUS_META`,
// `DELIVERABLE_STATUS_BADGE`, `DUE_STATUS_CLASSES`): el manual tiene que
// enseñar el MISMO color que la persona va a ver, no una aproximación.
const TASK_CHIP = {
  porIniciar: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  enProgreso: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  enRevision: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  devuelta: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  completada: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  cancelada: "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500",
};

const DELIVERABLE_CHIP = {
  borrador: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  enRevision: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  aprobado: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  cambios: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  rechazado: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
};

const DUE_CHIP = {
  vencida: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  porVencer: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  enPlazo: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  completada: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  sinFecha: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

export const MANUAL_SECTIONS: ManualSection[] = [
  // ── 1. Primeros pasos (todos) ────────────────────────────────────────────
  {
    id: "primeros-pasos",
    title: "Primeros pasos",
    Icon: Rocket,
    hint: "Para todo el mundo",
    articles: [
      {
        id: "bienvenida",
        title: "Qué es Bitácora OBJ",
        summary: "Para qué sirve la aplicación y qué parte te toca a ti.",
        keywords: ["inicio", "empezar", "introduccion", "que es"],
        blocks: [
          {
            kind: "p",
            text: "Bitácora OBJ es donde vive el trabajo de los proyectos: quién hace qué, para cuándo, y con qué se dio por entregado. Este manual cubre lo que necesitas si **haces** el trabajo o si **coordinas** a quien lo hace.",
          },
          {
            kind: "p",
            text: "Tu día ocurre en dos pantallas, y conviene tener clara la diferencia desde el principio:",
          },
          {
            kind: "table",
            head: ["Pantalla", "Qué encuentras ahí"],
            rows: [
              [
                "[[Espacios de Trabajo]]",
                "Todo lo de **un equipo**: sus tareas, sus entregables, su cronograma y sus archivos. Si estás en varios equipos, cambias entre ellos desde arriba.",
              ],
              [
                "[[Mis tareas]]",
                "**Todo lo tuyo, de todos los proyectos a la vez**, estés en un equipo o trabajando por tu cuenta. Es la vista para saber qué te toca hoy.",
              ],
            ],
          },
          {
            kind: "note",
            tone: "tip",
            title: "La regla corta",
            text: "¿Quieres ver cómo va tu equipo? Ve a [[Espacios de Trabajo]]. ¿Quieres saber qué tienes que entregar tú? Ve a [[Mis tareas]].",
          },
        ],
      },
      {
        id: "video",
        title: "Video: recorrido guiado",
        summary: "Un paseo por la aplicación de principio a fin, en video.",
        keywords: ["video", "tutorial", "recorrido", "demo", "capacitacion"],
        blocks: [
          {
            kind: "p",
            text: "Si prefieres verlo antes que leerlo, este recorrido cubre lo esencial: entrar a tu equipo, encontrar tu trabajo, comenzarlo y entregarlo, y qué pasa después con tu entrega.",
          },
          {
            kind: "video",
            src: MANUAL_VIDEO_URL,
            caption: "Recorrido guiado por Bitácora OBJ",
          },
          {
            kind: "p",
            text: "El video no sustituye al manual: para consultar un detalle concreto —qué significa un estado, por qué una tarea sale bloqueada— es más rápido buscarlo en el índice de la izquierda.",
          },
        ],
      },
      {
        id: "primer-ingreso",
        title: "Tu primer ingreso",
        summary: "Activar la cuenta, crear tu contraseña y completar tu perfil.",
        keywords: ["contrasena", "password", "activar", "login", "entrar", "perfil", "foto"],
        blocks: [
          {
            kind: "p",
            text: "No existe registro público: tu cuenta la crea la organización y te llega un correo con un enlace de activación.",
          },
          {
            kind: "steps",
            items: [
              "Abre el enlace del correo de activación. No hace falta que copies ninguna contraseña temporal.",
              "Crea tu contraseña: mínimo 8 caracteres y al menos un número.",
              "Ya dentro, ve a [[Configuración]] (abajo en el menú lateral) y sube tu foto y una breve descripción en [[Sobre mí]]. Es lo que verán tus compañeros junto a tus entregas.",
            ],
          },
          {
            kind: "note",
            tone: "warn",
            text: "Si entras y la aplicación te pide crear una contraseña antes de dejarte hacer nada, es normal: tu cuenta todavía está pendiente de activarse. No podrás avanzar hasta completar ese paso.",
          },
          {
            kind: "p",
            text: "Más adelante puedes cambiar tu contraseña cuando quieras desde [[Configuración]], indicando la actual y la nueva.",
          },
        ],
      },
      {
        id: "orientacion",
        title: "El menú lateral, de un vistazo",
        summary: "Qué hay detrás de cada opción y dónde están los avisos.",
        keywords: ["menu", "navegacion", "sidebar", "notificaciones", "modo oscuro", "tema"],
        blocks: [
          {
            kind: "p",
            text: "El menú de la izquierda es el mismo en toda la aplicación. Esto es lo que verás como integrante de un equipo:",
          },
          {
            kind: "list",
            items: [
              "[[Vista general]] — tu panel de inicio: lo que vence pronto, lo que está en revisión y tu actividad reciente.",
              "[[Mis proyectos]] — los proyectos en los que participas, con su avance.",
              "[[Espacios de Trabajo]] — el espacio de cada equipo al que perteneces.",
              "[[Mis tareas]] — todo lo asignado a ti y tus entregas.",
              "[[Notificaciones]] — el historial completo de avisos.",
              "[[Manual de usuario]] — esta guía.",
              "[[Configuración]] — tu perfil, tu contraseña y el envío de comentarios sobre la aplicación.",
            ],
          },
          {
            kind: "p",
            text: "Abajo del todo, junto a tu nombre, están la **campana de notificaciones**, los **recordatorios** y el interruptor de **modo claro / oscuro**. El botón de la esquina superior del menú lo **colapsa** a una franja de iconos cuando quieres más espacio; la aplicación recuerda tu preferencia.",
          },
          {
            kind: "note",
            tone: "info",
            text: "Si tu rol es de administración verás además opciones de gestión de proyectos y usuarios. Este manual no las cubre: se centra en el trabajo del día a día del equipo.",
          },
        ],
      },
      {
        id: "que-es-workspace",
        title: "Entrar a tu equipo",
        summary: "Cambiar de equipo, aceptar invitaciones y qué hay en cada sección.",
        keywords: ["equipo", "workspace", "invitacion", "secciones", "cambiar"],
        blocks: [
          {
            kind: "p",
            text: "En [[Espacios de Trabajo]] ves **un equipo a la vez**. El nombre del equipo, arriba a la izquierda, es un desplegable: si perteneces a varios, cambias entre ellos ahí. Al lado aparecen los avatares de tus compañeros, con una corona en quien lidera.",
          },
          {
            kind: "p",
            text: "Si te invitaron a un equipo, verás un aviso arriba con los botones [[Aceptar]] y [[Rechazar]]. Solo al aceptar pasas a ser integrante y el equipo aparece en tu desplegable.",
          },
          {
            kind: "p",
            text: "A la derecha está el menú de secciones del equipo. Esto es lo que hay en cada una:",
          },
          {
            kind: "table",
            head: ["Sección", "Para qué la usas"],
            rows: [
              ["[[Tareas]]", "El trabajo del equipo. Aquí comienzas y entregas lo tuyo."],
              [
                "[[Entregables]]",
                "Cada entrega con su historial de versiones y la conversación con quien revisa.",
              ],
              [
                "[[Estructura]]",
                "El árbol del proyecto: de qué parte del curso o del producto cuelga cada tarea.",
              ],
              ["[[Cronograma]]", "Las mismas tareas en una línea de tiempo, con sus dependencias."],
              ["[[Archivos]]", "El archivador del proyecto: las carpetas y ficheros del equipo."],
              ["[[Progreso]]", "Cómo va el equipo: avance, carga por persona y entregas."],
              ["[[Configuración]]", "Los avisos que quieres recibir de este equipo."],
            ],
          },
        ],
      },
      {
        id: "tu-rol",
        title: "Tu rol: integrante o líder",
        summary: "Las dos formas de usar la aplicación y en qué se diferencian.",
        keywords: ["rol", "integrante", "lider", "supervisor", "permisos", "diferencias"],
        blocks: [
          {
            kind: "p",
            text: "Dentro de cada equipo tienes uno de tres roles, y **es el que decide lo que ves y lo que puedes hacer**. Ojo: es un rol **por equipo**, así que puedes ser integrante en uno y líder en otro.",
          },
          {
            kind: "table",
            head: ["Rol", "Su trabajo en la aplicación"],
            rows: [
              [
                "Integrante",
                "Hace el trabajo: ve **lo suyo**, lo comienza, lo entrega y responde a las revisiones que recibe.",
              ],
              [
                "Líder",
                "Coordina: ve el trabajo de **todos**, lo reparte, revisa las entregas y gestiona al equipo.",
              ],
              [
                "Supervisor",
                "Igual que el líder para repartir y revisar el trabajo; no gestiona la composición del equipo.",
              ],
            ],
          },
          {
            kind: "p",
            text: "Este manual tiene una guía para cada uno. Ve directo a la tuya:",
          },
          {
            kind: "list",
            items: [
              "**Guía del integrante** — qué ves, cómo encuentras tu trabajo, cómo lo entregas y qué pasa con tus entregables.",
              "**Guía del líder** — qué ves de más, cómo repartes el trabajo y cómo revisas lo que te llega.",
            ],
          },
          {
            kind: "note",
            tone: "tip",
            text: "Si lideras un equipo, léete también la guía del integrante: tú también tienes tareas asignadas y las entregas exactamente igual que el resto.",
          },
        ],
      },
    ],
  },

  // ── 2. Guía del integrante ───────────────────────────────────────────────
  {
    id: "integrante",
    title: "Guía del integrante",
    Icon: UserRound,
    hint: "Hacer y entregar tu trabajo",
    articles: [
      {
        id: "integrante-que-ves",
        title: "Qué ves como integrante",
        summary: "El alcance de tu vista y qué puedes y no puedes hacer.",
        audience: "integrante",
        keywords: ["que veo", "alcance", "permisos", "puedo", "no puedo"],
        blocks: [
          {
            kind: "p",
            text: "La aplicación te muestra **tu** trabajo, no el de todo el equipo. No es que esté escondido: es que tu pantalla está acotada a lo que te toca, para que no tengas que filtrar entre el trabajo de doce personas para encontrar el tuyo.",
          },
          { kind: "p", text: "En concreto, dentro del espacio del equipo:" },
          {
            kind: "list",
            items: [
              "En [[Tareas]] la lista viene ya filtrada a las tareas **asignadas a ti**.",
              "En [[Estructura]] solo se dibujan las ramas del proyecto donde tienes trabajo.",
              "En [[Cronograma]] ves **tus** barras, no las de tus compañeros.",
              "En [[Progreso]] sí ves cómo va el equipo completo: es información de contexto, no de reparto.",
              "En [[Archivos]] ves la raíz del proyecto y las carpetas de **tus** equipos.",
            ],
          },
          { kind: "p", text: "Y esto es lo que puedes hacer con ello:" },
          {
            kind: "table",
            head: ["Puedes", "No puedes"],
            rows: [
              [
                "Comenzar y entregar tus tareas",
                "Aprobar, devolver o rechazar una entrega (ni la tuya ni la de otro)",
              ],
              [
                "Subir versiones y corregir las tuyas",
                "Crear, editar, reasignar o eliminar tareas",
              ],
              [
                "Comentar y mencionar en cualquier entregable del equipo",
                "Filtrar el trabajo por otra persona",
              ],
              [
                "Subir archivos a las carpetas de tu equipo",
                "Cambiar roles, invitar o quitar integrantes",
              ],
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: "Si echas en falta un botón que un compañero sí tiene, casi siempre es esto: esa persona es **Líder** o **Supervisor** del equipo.",
          },
        ],
      },
      {
        id: "ver-tareas",
        title: "Encontrar tus tareas",
        summary: "Lista o Kanban, y los filtros para llegar a lo que buscas.",
        audience: "integrante",
        keywords: ["lista", "kanban", "filtros", "buscar", "tablero"],
        blocks: [
          {
            kind: "p",
            text: "La sección [[Tareas]] abre en modo [[Lista]]. Puedes cambiar a [[Kanban]] para ver el mismo trabajo repartido en columnas por estado, con una columna roja **En riesgo** al frente que junta lo vencido o a punto de vencer.",
          },
          {
            kind: "note",
            tone: "warn",
            title: "El Kanban es de solo lectura",
            text: "En [[Kanban]] no aparece [[Comenzar]]. Para arrancar una tarea vuelve a [[Lista]] o usa [[Estructura]].",
          },
          {
            kind: "p",
            text: "Debajo tienes la barra de filtros. Se combinan entre sí y afectan a la vez a [[Lista]], [[Kanban]] y [[Estructura]]:",
          },
          {
            kind: "list",
            items: [
              "**Buscar** — por texto del título de la tarea.",
              "**Estado** — por iniciar, en progreso, en revisión, devuelta, completada o cancelada.",
              "**Elemento** — la pieza concreta de la estructura de la que cuelga la tarea.",
              "**Rama** — un nivel más arriba: trae todo lo que cuelga de esa parte del proyecto.",
              "**Solo bloqueadas** — deja únicamente lo que hoy no puedes avanzar.",
            ],
          },
          {
            kind: "p",
            text: "El botón [[Limpiar]] devuelve la vista a su estado inicial. Junto a los filtros siempre se ve cuántas tareas estás viendo del total, para que nunca creas que «no hay nada» cuando en realidad hay un filtro puesto.",
          },
          {
            kind: "note",
            tone: "tip",
            text: "Cada fila lleva a la izquierda una franja de color: es el color del **tipo del elemento** del que sale la tarea. Sirve para distinguir de un vistazo dos tareas que se llaman igual pero vienen de módulos distintos.",
          },
        ],
      },
      {
        id: "estados-tarea",
        title: "Qué significa cada estado",
        summary: "La leyenda de las pastillas, la urgencia y la barra de avance.",
        keywords: ["estado", "colores", "leyenda", "urgencia", "prioridad", "avance", "porcentaje"],
        blocks: [
          { kind: "p", text: "El **estado** dice en qué punto del camino está la tarea:" },
          {
            kind: "legend",
            items: [
              {
                label: "Por iniciar",
                desc: "Está asignada pero nadie ha dicho que empezó.",
                chip: TASK_CHIP.porIniciar,
              },
              {
                label: "En progreso",
                desc: "Alguien pulsó [[Comenzar]] y está trabajando en ella.",
                chip: TASK_CHIP.enProgreso,
              },
              {
                label: "En revisión",
                desc: "Se entregó y espera que quien coordina la apruebe o la devuelva.",
                chip: TASK_CHIP.enRevision,
              },
              {
                label: "Devuelta",
                desc: "Quien revisó pidió cambios. Vuelve a ti para corregir y entregar otra vez.",
                chip: TASK_CHIP.devuelta,
              },
              {
                label: "Completada",
                desc: "Cerrada, al 100 %. Ya no hay nada que hacer.",
                chip: TASK_CHIP.completada,
              },
              {
                label: "Cancelada",
                desc: "Se descartó. No cuenta para el avance.",
                chip: TASK_CHIP.cancelada,
              },
            ],
          },
          {
            kind: "p",
            text: "La **urgencia** es aparte del estado y la fija quien reparte el trabajo: **Sin definir**, **Baja**, **Media**, **Alta** o **Crítica**.",
          },
          {
            kind: "p",
            text: "La **barra de avance** con su porcentaje sale del estado. En una tarea **con subtareas** no es un número inventado: es el promedio del avance de sus subtareas, así que solo llega al 100 % cuando todas están cerradas.",
          },
          {
            kind: "note",
            tone: "info",
            text: "La fecha de la derecha cambia de forma según lo cerca que esté: si faltan pocos días dice «En 3 d», si ya pasó dice «Vencida 2 d» en rojo, y si queda lejos muestra la fecha completa.",
          },
        ],
      },
      {
        id: "comenzar-tarea",
        title: "Comenzar una tarea",
        summary: "El primer paso, y a quién avisa cuando lo das.",
        audience: "integrante",
        keywords: ["comenzar", "empezar", "iniciar", "en progreso"],
        blocks: [
          {
            kind: "p",
            text: "Cuando vayas a ponerte con una tarea tuya, pulsa [[Comenzar]] en su fila. La tarea pasa a **En progreso** y se avisa automáticamente a quien lidera o supervisa tu equipo: no tienes que escribirle para contarle que arrancaste.",
          },
          {
            kind: "note",
            tone: "tip",
            title: "Por qué importa pulsarlo",
            text: "El cronograma y el avance del proyecto se calculan con estos estados. Una tarea que trabajas pero dejas en **Por iniciar** hace que el proyecto parezca más atrasado de lo que está.",
          },
          {
            kind: "p",
            text: "El botón solo aparece cuando **es tu tarea** y aún no ha arrancado. No lo verás en dos casos:",
          },
          {
            kind: "list",
            items: [
              "En una **tarea con subtareas**: esa avanza sola a medida que arrancas sus subtareas. Comienza las subtareas, no la tarea de arriba.",
              "En una tarea que depende de otra sin terminar: en su lugar verás [[Bloqueada]].",
            ],
          },
        ],
      },
      {
        id: "entregar-tarea",
        title: "Entregar una tarea",
        summary: "Las dos formas de entregar y en qué se diferencian.",
        audience: "integrante",
        keywords: ["entregar", "entrega", "sin adjunto", "adjunto", "evidencia", "terminar"],
        blocks: [
          {
            kind: "p",
            text: "En cuanto una tarea tuya está **En progreso** aparecen dos botones en su fila. Los dos la dan por hecha; la diferencia es si dejas una evidencia.",
          },
          {
            kind: "table",
            head: ["Botón", "Qué hace"],
            rows: [
              [
                "[[Entregar]]",
                "Abre una ventana para adjuntar el trabajo (un enlace o un archivo). Crea el **entregable** con su primera versión, y quien coordina lo revisa y lo aprueba o lo devuelve.",
              ],
              [
                "[[Entregar sin adjunto]]",
                "Da la tarea por hecha **sin crear ningún entregable**: pasa directa al 100 % y se avisa a quien coordina. No hay nada que revisar ni que abrir.",
              ],
            ],
          },
          {
            kind: "note",
            tone: "warn",
            title: "Elige bien",
            text: "[[Entregar sin adjunto]] **cierra la tarea de inmediato** y no pasa por revisión. Úsalo cuando de verdad no hay nada que adjuntar (una gestión, una llamada, una revisión presencial). Si tu trabajo produce algo que otro tiene que mirar, usa [[Entregar]].",
          },
          { kind: "p", text: "Al pulsar [[Entregar]], en la ventana eliges qué estás entregando:" },
          {
            kind: "list",
            items: [
              "**Enlace** — Figma, Google Drive, Notion o un documento publicado.",
              "**Repositorio** — GitHub, GitLab o Bitbucket: un PR, una rama o un commit.",
              "**SCORM** — la URL del paquete publicado en el LMS.",
              "**Archivo** — lo subes desde tu equipo y queda guardado en la carpeta de tu equipo, dentro de [[Archivos]] del proyecto. También puedes arrastrarlo sobre la ventana.",
            ],
          },
          {
            kind: "p",
            text: "Puedes añadir una **nota** (qué estás entregando) y unas **observaciones** (instrucciones para quien lo recibe). Al confirmar, la entrega queda registrada y **te quedas donde estabas**: no hace falta ir a ninguna otra pestaña.",
          },
          {
            kind: "note",
            tone: "tip",
            text: "¿No ves ninguno de los dos botones? Mira el tema [[Cuando no puedes entregar]] en la sección de ayuda: casi siempre es que la tarea aún no está comenzada, tiene subtareas abiertas o está bloqueada.",
          },
        ],
      },
      {
        id: "subtareas",
        title: "Tareas con subtareas",
        summary: "Cómo avanza una tarea que se repartió en partes más pequeñas.",
        audience: "integrante",
        keywords: ["subtarea", "subtareas", "padre", "hijas", "dividir"],
        blocks: [
          {
            kind: "p",
            text: "Quien lidera puede partir una tarea grande en subtareas. En la lista aparecen **indentadas bajo su tarea principal**, con un chevron para desplegarlas u ocultarlas. Al abrir la vista salen plegadas: primero ves el trabajo grande y despliegas lo que te interese.",
          },
          { kind: "p", text: "El recorrido es este:" },
          {
            kind: "steps",
            items: [
              "Comienzas y entregas **cada subtarea** por separado, con los mismos dos botones de siempre.",
              "La tarea principal sube sola a **En progreso** en cuanto arranca su primera subtarea, y su porcentaje va subiendo con ellas.",
              "Cuando **todas** las subtareas están cerradas, la tarea principal llega al 100 % y muestra la etiqueta [[Entregable listo]].",
              "Recién entonces aparecen [[Entregar]] y [[Entregar sin adjunto]] en la tarea principal, para cerrarla tú.",
            ],
          },
          {
            kind: "note",
            tone: "warn",
            text: "Mientras quede **una sola** subtarea abierta, la tarea principal no ofrece botones de entrega. No es un fallo: es que el trabajo todavía no está completo.",
          },
          {
            kind: "p",
            text: "Las subtareas también pueden depender entre sí. Si la tuya va después de otra, verás [[Bloqueada]] hasta que tu compañero cierre la suya.",
          },
        ],
      },
      {
        id: "tarea-bloqueada",
        title: "Cuando una tarea está bloqueada",
        summary: "Por qué aparece «Bloqueada» y qué puedes hacer.",
        keywords: ["bloqueada", "dependencia", "terceros", "candado", "no puedo entregar"],
        blocks: [
          {
            kind: "p",
            text: "Si en lugar de un botón ves la etiqueta [[Bloqueada]] con un candado, el sistema está impidiendo un paso que fallaría de todas formas. Pasa el cursor por encima y te dice el motivo exacto. Hay tres:",
          },
          {
            kind: "list",
            items: [
              "**Depende de otra tarea que no está completada.** Debajo del título verás «Bloqueada por: …» con el nombre de la que falta.",
              "**Depende de una actividad de terceros** que aún no se ha entregado — un material o una aprobación que viene de fuera. Se marca con la etiqueta ámbar [[Depende de terceros]].",
              "**Tiene subtareas abiertas.** Cierra las subtareas y la tarea principal se desbloquea sola.",
            ],
          },
          {
            kind: "note",
            tone: "tip",
            text: "En [[Mis tareas]] la etiqueta [[Bloqueada]] es además pulsable: se abre un panel con las tareas que faltan, su estado y **quién las tiene**, para que sepas a quién preguntar.",
          },
          {
            kind: "p",
            text: "No hay nada que puedas hacer desde tu lado salvo avisar a quien tiene el trabajo previo. En cuanto esa persona lo cierre, tu tarea se desbloquea sola y —si tenía fechas— se reprograma automáticamente para arrancar cuando corresponde.",
          },
        ],
      },
      {
        id: "entregables",
        title: "Tus entregables y sus revisiones",
        summary: "Qué pasa con tu entrega después de enviarla, y cómo responder a los cambios.",
        audience: "integrante",
        keywords: ["entregable", "versiones", "revision", "comentarios", "aprobado", "devuelta"],
        blocks: [
          {
            kind: "p",
            text: "Cada vez que entregas con adjunto se crea un **entregable** en la sección [[Entregables]]. A la izquierda está la lista; al centro, su historial de versiones; a la derecha, la conversación.",
          },
          { kind: "p", text: "A partir de ahí, el circuito visto desde tu lado es este:" },
          {
            kind: "steps",
            items: [
              "Entregas. El entregable queda **En Revisión** y tu tarea también pasa a **En revisión**.",
              "Quien lidera o supervisa lo mira y decide.",
              "Si lo **aprueba**, el entregable queda **Aprobado** y tu tarea pasa a **Completada**. Ya está.",
              "Si te **pide cambios**, el entregable queda en **Cambios Solicitados** y tu tarea vuelve a **Devuelta**: te llega el aviso con el motivo escrito.",
              "Corriges y **añades una versión más al mismo entregable**. Vuelve a estar En Revisión y se repite el ciclo.",
            ],
          },
          {
            kind: "note",
            tone: "warn",
            title: "No crees un entregable nuevo",
            text: "Cuando te piden cambios, abre el que ya existe y súbele otra versión. Se numeran V1, V2, V3… y así queda claro qué cambió entre una y otra. Un entregable nuevo rompe ese hilo.",
          },
          { kind: "p", text: "Los cinco estados posibles de un entregable:" },
          {
            kind: "legend",
            items: [
              {
                label: "Borrador",
                desc: "Se creó pero todavía no tiene ninguna versión entregada.",
                chip: DELIVERABLE_CHIP.borrador,
              },
              {
                label: "En Revisión",
                desc: "Entregado. Espera que quien coordina lo mire.",
                chip: DELIVERABLE_CHIP.enRevision,
              },
              {
                label: "Aprobado",
                desc: "Aceptado. La tarea queda completada.",
                chip: DELIVERABLE_CHIP.aprobado,
              },
              {
                label: "Cambios Solicitados",
                desc: "Sigue vivo: hay que corregir y subir otra versión.",
                chip: DELIVERABLE_CHIP.cambios,
              },
              {
                label: "Rechazado",
                desc: "Se cerró tal como estaba. El motivo queda en el historial.",
                chip: DELIVERABLE_CHIP.rechazado,
              },
            ],
          },
          {
            kind: "p",
            text: "Puedes corregir una versión que acabas de subir (el enlace, la nota o las observaciones) y borrar el entregable completo mientras **no esté aprobado**. Una vez aprobado queda como registro. En el hilo de la derecha puedes comentar y **mencionar** a alguien para que le llegue el aviso.",
          },
        ],
      },
      {
        id: "mis-tareas-vista",
        title: "Mis tareas: las tres pestañas",
        summary: "Qué hay en Mis tareas, Mis entregas y Para revisar.",
        keywords: ["mis entregas", "pestanas", "revisar", "personal"],
        blocks: [
          {
            kind: "p",
            text: "[[Mis tareas]] junta **todo lo asignado a ti**, sin importar el proyecto ni si va por equipo. Tiene tres pestañas:",
          },
          {
            kind: "table",
            head: ["Pestaña", "Qué contiene"],
            rows: [
              [
                "[[Mis tareas]]",
                "Tu lista de trabajo pendiente, de todos los proyectos, con el aviso de vencimiento de cada tarea.",
              ],
              [
                "[[Mis entregas]]",
                "Las entregas **individuales** que has hecho (las de tareas sin equipo), con su historial y su conversación.",
              ],
              [
                "[[Para revisar]]",
                "Solo si coordinas o supervisas algún proyecto: las entregas individuales que esperan tu visto bueno. Lleva un contador.",
              ],
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: "Las entregas de **equipo** no salen en [[Mis entregas]]: viven en la sección [[Entregables]] de su equipo, porque ahí es donde su líder las revisa.",
          },
        ],
      },
      {
        id: "mis-tareas-filtros",
        title: "Filtrar y ver tu trabajo",
        summary: "Lista, Estructura o Cronograma, y los filtros para acotar.",
        keywords: ["filtros", "vencidas", "por vencer", "cronograma", "estructura", "proyecto"],
        blocks: [
          { kind: "p", text: "La pestaña [[Mis tareas]] ofrece tres formas de mirar lo mismo:" },
          {
            kind: "list",
            items: [
              "[[Lista]] — agrupada por proyecto y ordenada por urgencia: primero lo vencido, luego lo que vence pronto.",
              "[[Estructura]] — tus tareas colgando del árbol del proyecto, para ver de qué parte salen.",
              "[[Cronograma]] — tus tareas en una línea de tiempo.",
            ],
          },
          { kind: "p", text: "Y estos filtros, que se combinan:" },
          {
            kind: "list",
            items: [
              "**Estado del vencimiento** — [[Todas]], [[Vencidas]], [[Por vencer]], [[Abiertas]] (lo que abre por defecto) o [[Completadas]]. Vencidas y Por vencer llevan su contador al lado.",
              "**Origen** — [[Todas]], [[Individuales]] o [[En equipo]].",
              "**Proyecto** — si trabajas en varios, eliges uno.",
              "**Buscador** por tarea o proyecto, y un filtro por **elemento** de la estructura que trae todo lo que cuelga de esa rama.",
            ],
          },
          { kind: "p", text: "Cada tarea muestra una pastilla con su situación de fecha:" },
          {
            kind: "legend",
            items: [
              {
                label: "Vencida",
                desc: "La fecha límite ya pasó y sigue abierta.",
                chip: DUE_CHIP.vencida,
              },
              {
                label: "Por vencer",
                desc: "Vence dentro de los próximos 3 días.",
                chip: DUE_CHIP.porVencer,
              },
              { label: "En plazo", desc: "Hay tiempo de sobra.", chip: DUE_CHIP.enPlazo },
              { label: "Completada", desc: "Ya está cerrada.", chip: DUE_CHIP.completada },
              {
                label: "Sin fecha",
                desc: "Todavía no tiene fecha límite planificada.",
                chip: DUE_CHIP.sinFecha,
              },
            ],
          },
        ],
      },
      {
        id: "entregar-desde-mis-tareas",
        title: "Entregar desde Mis tareas",
        summary: "El botón cambia según la tarea sea individual o de equipo.",
        audience: "integrante",
        keywords: ["entregar", "individual", "equipo", "boton"],
        blocks: [
          { kind: "p", text: "En cada fila, el botón de la derecha depende del tipo de tarea:" },
          {
            kind: "table",
            head: ["Si la tarea es…", "Verás"],
            rows: [
              [
                "De un equipo",
                "[[Entregar en el equipo]], que te lleva al espacio de ese equipo. La entrega se hace ahí, donde su líder la revisa.",
              ],
              [
                "Individual",
                "[[Entregar]] (o [[Ver entrega]] si ya la empezaste) y, si es una tarea principal, también [[Entregar sin adjunto]].",
              ],
              [
                "Bloqueada",
                "La etiqueta [[Bloqueada]]. Púlsala para ver qué falta y quién lo tiene.",
              ],
            ],
          },
          {
            kind: "p",
            text: "En una tarea individual, [[Entregar]] abre (o crea) su entrega personal y salta a la pestaña [[Mis entregas]], donde adjuntas el trabajo y sigues su revisión. [[Entregar sin adjunto]] la cierra al 100 % sin crear nada que revisar, igual que en el equipo.",
          },
          {
            kind: "note",
            tone: "info",
            text: "Al crear una entrega individual puedes marcar **Requiere revisión**. Si lo dejas sin marcar, entregar completa la tarea directamente; si lo marcas, pasa por un responsable del proyecto.",
          },
        ],
      },
      {
        id: "mis-entregas-detalle",
        title: "Trabajar una entrega individual",
        summary: "Adjuntar, corregir y conversar en tus entregas personales.",
        audience: "integrante",
        keywords: ["mis entregas", "version", "adjuntar", "comentar", "personal"],
        blocks: [
          {
            kind: "p",
            text: "La pestaña [[Mis entregas]] funciona igual que los entregables del equipo: lista a la izquierda, historial de versiones al centro y conversación a la derecha.",
          },
          {
            kind: "steps",
            items: [
              "Elige la entrega en la lista de la izquierda.",
              "En el bloque de registro, elige el tipo (enlace, repositorio, SCORM o archivo) y pega la URL o suelta el fichero.",
              "Añade una nota y, si hace falta, observaciones para quien revise.",
              "Confirma. La versión queda guardada y la tarea se mueve al estado que corresponda.",
            ],
          },
          {
            kind: "p",
            text: "Arriba de la entrega, cuando está vinculada a una tarea tuya, hay un aviso que te recuerda si pasará por revisión, con un botón para [[Exigir revisión]] o [[Quitar revisión]].",
          },
        ],
      },
    ],
  },

  // ── 3. Guía del líder ────────────────────────────────────────────────────
  {
    id: "lider",
    title: "Guía del líder",
    Icon: Crown,
    hint: "Repartir, revisar y hacer seguimiento",
    articles: [
      {
        id: "lider-que-ves",
        title: "Qué ves como líder o supervisor",
        summary: "Todo lo que aparece de más respecto a un integrante.",
        audience: "lider",
        keywords: ["que veo", "lider", "supervisor", "diferencias", "permisos"],
        blocks: [
          {
            kind: "p",
            text: "Con rol **Líder** o **Supervisor** en un equipo, las mismas pantallas te muestran el trabajo de **todo el equipo**, no solo el tuyo, y aparecen los controles para repartirlo y revisarlo.",
          },
          {
            kind: "table",
            head: ["En la sección…", "Lo que tú ves de más"],
            rows: [
              [
                "[[Tareas]]",
                "Abre en la **bolsa del equipo** (las tareas sin responsable). Puedes filtrar por persona, agrupar [[Por integrante]] o [[Por estado]], y tienes [[Nueva tarea]], el **+** para subtareas, y editar, reasignar y eliminar en cada fila.",
              ],
              [
                "[[Tareas]] › [[Trazabilidad]]",
                "Una tercera vista, exclusiva tuya: el historial de todo lo que ha pasado con cada tarea del equipo.",
              ],
              [
                "[[Entregables]]",
                "Los botones de revisión: [[Aprobar]], [[Solicitar cambios]] y [[Rechazar]].",
              ],
              [
                "[[Estructura]] y [[Cronograma]]",
                "El trabajo de **todo** el equipo (un integrante solo ve el suyo), con la barra de filtros para acotar.",
              ],
              [
                "[[Configuración]]",
                "La lista de [[Integrantes]] con su carga, el cambio de rol, quitar gente y archivar el equipo.",
              ],
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: "El rol es **por equipo**. En un equipo donde eres integrante verás la pantalla de integrante, aunque lideres otro.",
          },
          {
            kind: "note",
            tone: "warn",
            text: "Una cosa que **no** puedes hacer: aprobar tu propia entrega. Si una tarea es tuya, la entregas como cualquiera y la revisa otra persona con permiso.",
          },
        ],
      },
      {
        id: "repartir-trabajo",
        title: "Repartir el trabajo",
        summary: "Crear tareas, asignarlas y partirlas en subtareas.",
        audience: "lider",
        keywords: ["asignar", "reasignar", "crear tarea", "subtarea", "bolsa", "delegar"],
        blocks: [
          {
            kind: "p",
            text: "La sección [[Tareas]] abre mostrando la **bolsa del equipo**: las tareas que todavía no tienen responsable. Es tu punto de partida para repartir.",
          },
          {
            kind: "list",
            items: [
              "[[Nueva tarea]] crea trabajo para tu equipo: puedes dejarla en la bolsa o asignarla ya a alguien, colgarla de un elemento de la estructura y ponerle fechas y urgencia.",
              "El icono **+** de una fila añade una **subtarea** a esa tarea. Al crearla puedes indicar que va **después** de otra subtarea hermana.",
              "La pastilla del responsable es un selector: pulsándola reasignas la tarea entre los integrantes de tu equipo.",
              "Los iconos de lápiz y papelera editan o eliminan la tarea. Eliminar una tarea elimina también sus subtareas.",
            ],
          },
          {
            kind: "p",
            text: "Con [[Por integrante]] agrupas la lista por persona para ver de un vistazo cómo está repartida la carga; con [[Por estado]] la agrupas por la fase del trabajo.",
          },
          {
            kind: "note",
            tone: "tip",
            title: "La decisión que más te va a afectar",
            text: "Al crear la tarea eliges si **requiere aprobación**. Sin ella, quien la tiene entrega y la tarea queda cerrada sola; con ella, pasa por ti antes de darse por hecha. Actívala solo donde de verdad vas a revisar: si la pones en todo, tu cola de revisión se convierte en el cuello de botella del proyecto.",
          },
        ],
      },
      {
        id: "lider-entregables",
        title: "El circuito de una entrega",
        summary: "Qué te llega, por dónde, y en qué estado queda la tarea.",
        audience: "lider",
        keywords: ["entregable", "circuito", "flujo", "entregas", "cola"],
        blocks: [
          {
            kind: "p",
            text: "No todo lo que entrega tu equipo pasa por ti. Conviene tener claro qué te llega y qué no:",
          },
          {
            kind: "table",
            head: ["Cómo entregó", "Qué pasa"],
            rows: [
              [
                "[[Entregar]] en una tarea **con aprobación**",
                "Se crea el entregable **En Revisión** y la tarea queda **En revisión**. Aparece en [[Entregables]] esperándote.",
              ],
              [
                "[[Entregar]] en una tarea **sin aprobación**",
                "Se registra el entregable y la tarea se **completa sola**. Lo ves en [[Entregables]] como registro, pero no tienes que hacer nada.",
              ],
              [
                "[[Entregar sin adjunto]]",
                "**No se crea entregable.** La tarea pasa directa al 100 % y te llega un aviso. No hay nada que revisar.",
              ],
              [
                "Entrega **individual** (tarea sin equipo)",
                "No aparece en el equipo: la revisas en [[Mis tareas]] › [[Para revisar]].",
              ],
            ],
          },
          {
            kind: "p",
            text: "En la sección [[Entregables]] tienes la lista a la izquierda con el estado de cada una. Al abrir una ves su **historial de versiones** (V1, V2, V3…) con quién subió cada una y cuándo, más la nota y las observaciones que escribió, y a la derecha el hilo de conversación.",
          },
          {
            kind: "note",
            tone: "tip",
            text: "Mira siempre la **última versión** y las observaciones que la acompañan: ahí es donde la persona te dice qué cambió respecto a lo que le devolviste.",
          },
        ],
      },
      {
        id: "revisar-entregas",
        title: "Revisar una entrega",
        summary: "Aprobar, pedir cambios o rechazar, y qué le pasa a la tarea.",
        audience: "lider",
        keywords: ["aprobar", "rechazar", "solicitar cambios", "revisar", "revision"],
        blocks: [
          {
            kind: "p",
            text: "Abre el entregable, mira la última versión y decide. Son tres botones y cada uno deja la tarea en un sitio distinto:",
          },
          {
            kind: "table",
            head: ["Botón", "El entregable queda", "Y la tarea"],
            rows: [
              ["[[Aprobar]]", "**Aprobado**", "**Completada**. Fin del circuito."],
              [
                "[[Solicitar cambios]]",
                "**Cambios Solicitados**",
                "**Devuelta**. Sigue viva y espera otra versión.",
              ],
              [
                "[[Rechazar]]",
                "**Rechazado**",
                "Se cierra tal como está. El motivo queda registrado.",
              ],
            ],
          },
          {
            kind: "note",
            tone: "warn",
            title: "El motivo no es opcional",
            text: "En [[Solicitar cambios]] y [[Rechazar]] tienes que escribir por qué. Es lo único que la otra persona va a tener para saber qué corregir — sé concreto. En [[Aprobar]] el comentario sí es opcional: el trabajo habla por sí solo.",
          },
          {
            kind: "p",
            text: "En los tres casos se avisa a quien entregó. Si pediste cambios, cuando suba la V2 el entregable vuelve a **En Revisión** y te toca de nuevo.",
          },
          {
            kind: "note",
            tone: "info",
            text: "Aprobar una tarea puede desbloquear otras: las que dependían de ella se desbloquean y se reprograman solas, y sus responsables reciben el aviso con la nueva fecha.",
          },
        ],
      },
      {
        id: "revisar-individuales",
        title: "La cola de entregas individuales",
        summary: "Revisar el trabajo que no va por equipo.",
        audience: "lider",
        keywords: ["para revisar", "individual", "personal", "cola", "coordinador"],
        blocks: [
          {
            kind: "p",
            text: "Las tareas **sin equipo** (individuales) no pasan por la sección [[Entregables]] de ningún equipo. Si coordinas o supervisas el proyecto al que pertenecen, sus entregas te llegan a [[Mis tareas]] › [[Para revisar]], con un contador al lado de la pestaña.",
          },
          {
            kind: "p",
            text: "La pantalla es la misma que la de un entregable de equipo: historial de versiones al centro, conversación a la derecha, y los mismos tres botones de revisión.",
          },
          {
            kind: "note",
            tone: "info",
            text: "Aquí el permiso no viene del rol de equipo sino del **rol de proyecto**: aparece si eres coordinador o supervisor del proyecto de esa tarea.",
          },
        ],
      },
      {
        id: "seguir-equipo",
        title: "Seguir cómo va el equipo",
        summary: "Progreso, carga por persona y trazabilidad.",
        audience: "lider",
        keywords: ["progreso", "carga", "rendimiento", "trazabilidad", "seguimiento"],
        blocks: [
          {
            kind: "p",
            text: "La sección [[Progreso]] resume el estado del equipo: cuánto lleva hecho, qué está en revisión, qué va con retraso y cómo se reparte el trabajo entre las personas.",
          },
          {
            kind: "p",
            text: "En [[Tareas]] tienes además la vista [[Trazabilidad]], con el historial de lo que ha pasado con cada tarea del equipo: cambios de estado, reasignaciones y entregas, con quién y cuándo.",
          },
          {
            kind: "p",
            text: "En [[Cronograma]] ves las barras de **todo** el equipo, con las flechas de dependencia para detectar dónde se va a atascar la cadena.",
          },
          {
            kind: "note",
            tone: "tip",
            text: "En la lista de [[Integrantes]] de la sección [[Configuración]] cada persona muestra su carga **relativa al integrante más ocupado**: es la forma rápida de ver a quién le estás cargando de más.",
          },
        ],
      },
      {
        id: "gestionar-equipo",
        title: "Gestionar el equipo",
        summary: "Invitar, cambiar roles y archivar el equipo.",
        audience: "lider",
        keywords: ["invitar", "integrantes", "roles", "archivar", "quitar"],
        blocks: [
          {
            kind: "p",
            text: "Desde [[Invitar]] (arriba, junto al nombre del equipo) sumas gente al equipo. La persona recibe la invitación y entra al aceptarla.",
          },
          {
            kind: "p",
            text: "En la sección [[Configuración]] del equipo puedes renombrarlo, cambiar su descripción, ajustar el rol de cada integrante y quitar a alguien del equipo. Los tres roles son:",
          },
          {
            kind: "table",
            head: ["Rol", "Qué puede hacer"],
            rows: [
              [
                "Líder",
                "Todo: repartir trabajo, revisar entregas, gestionar integrantes y ajustes del equipo.",
              ],
              ["Supervisor", "Igual que el líder para repartir y revisar el trabajo."],
              ["Integrante", "Trabaja y entrega lo suyo; comenta, pero no aprueba."],
            ],
          },
          {
            kind: "note",
            tone: "warn",
            text: "Un equipo debe conservar **al menos un líder**: la aplicación no te dejará quitarle el rol al último que quede. Archivar el equipo lo saca del proyecto y sus integrantes pierden el acceso, pero las tareas y las entregas se conservan.",
          },
        ],
      },
    ],
  },

  // ── 4. Las herramientas del proyecto (ambos roles) ───────────────────────
  {
    id: "proyecto",
    title: "Herramientas del proyecto",
    Icon: Boxes,
    hint: "Iguales para los dos roles",
    articles: [
      {
        id: "estructura-cronograma",
        title: "Estructura y Cronograma",
        summary: "Ver de dónde sale el trabajo y cómo encaja en el calendario.",
        keywords: ["estructura", "arbol", "cronograma", "gantt", "fechas", "calendario"],
        blocks: [
          {
            kind: "p",
            text: "[[Estructura]] muestra el árbol del proyecto y cuelga cada tarea de la pieza a la que pertenece. Solo se dibujan las ramas donde el equipo tiene trabajo, así que no te pierdes en partes que no tocan.",
          },
          {
            kind: "p",
            text: "Es una vista **de trabajo**, no de solo lectura: desde aquí también se puede pulsar [[Comenzar]], [[Entregar]] y [[Entregar sin adjunto]], con las mismas reglas que en la lista. Mucha gente la prefiere porque ve el contexto de lo que entrega.",
          },
          {
            kind: "p",
            text: "[[Cronograma]] pone esas mismas tareas en una línea de tiempo, con flechas entre las que dependen unas de otras. Un integrante ve **sus** barras; quien coordina ve las de todo el equipo.",
          },
          {
            kind: "note",
            tone: "tip",
            text: "Si se mueve una fecha porque la tarea de la que dependes se entregó antes o después, te llega un aviso con la nueva fecha de inicio. No hay que recalcular nada a mano.",
          },
        ],
      },
      {
        id: "archivos-equipo",
        title: "Los archivos del proyecto",
        summary: "Navegar el archivador, subir ficheros y encontrar entregas anteriores.",
        keywords: ["archivos", "carpetas", "subir", "drive", "descargar", "documentos"],
        blocks: [
          {
            kind: "p",
            text: "[[Archivos]] es el archivador del proyecto y funciona como cualquier gestor de archivos: entras en una carpeta a la vez y vuelves con la **ruta de migas** de arriba.",
          },
          {
            kind: "list",
            items: [
              "Cambia entre **lista** y **cuadrícula** con los dos botones de la derecha; la aplicación recuerda tu elección.",
              "El buscador filtra **dentro de la carpeta abierta**, por nombre.",
              "Para subir algo usa [[Subir]] o **arrastra el fichero** sobre la zona de contenido.",
              "[[Nueva carpeta]] crea una subcarpeta donde estés parado.",
              "Al pulsar el nombre de un fichero se abre una vista previa; el icono de descarga lo baja a tu equipo.",
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: "Los archivos que se entregan desde una tarea aterrizan aquí solos, en la carpeta del equipo, y se marcan con una etiqueta **V1**, **V2**… junto al nombre de la tarea de la que salieron.",
          },
          {
            kind: "p",
            text: "Un integrante ve la raíz del proyecto y las carpetas de **sus** equipos. Si el archivador aparece recortado, la propia pantalla lo dice: la jerarquía completa la ve quien coordina el proyecto.",
          },
        ],
      },
      {
        id: "avisos-equipo",
        title: "Los avisos de tu equipo",
        summary: "Elegir qué notificaciones quieres recibir de cada equipo.",
        keywords: ["notificaciones", "avisos", "correo", "silenciar", "campana"],
        blocks: [
          {
            kind: "p",
            text: "En la sección [[Configuración]] del equipo, el bloque [[Notificaciones del equipo]] tiene cuatro interruptores. Son **por equipo**: puedes seguir de cerca uno y silenciar otro.",
          },
          {
            kind: "list",
            items: [
              "**Se me asigna una tarea nueva**",
              "**Rechazan o devuelven un entregable**",
              "**Alguien comenta en un entregable**",
              "**Se aprueba un entregable**",
            ],
          },
          {
            kind: "p",
            text: "Los avisos llegan a la **campana** del menú lateral y quedan en [[Notificaciones]], donde puedes filtrarlos y borrar los que ya no necesites. Algunos se envían además por correo.",
          },
        ],
      },
    ],
  },

  // ── 5. Ayuda rápida ──────────────────────────────────────────────────────
  {
    id: "ayuda",
    title: "Ayuda rápida",
    Icon: LifeBuoy,
    articles: [
      {
        id: "no-puedes-entregar",
        title: "Cuando no puedes entregar",
        summary: "Las razones por las que no aparece el botón, en orden.",
        keywords: ["no veo", "no aparece", "boton entregar", "problema", "error"],
        blocks: [
          {
            kind: "p",
            text: "Si no ves [[Entregar]] ni [[Entregar sin adjunto]] en una tarea, recorre esta lista en orden. Casi siempre es la primera:",
          },
          {
            kind: "steps",
            items: [
              "**¿Está comenzada?** Los botones solo aparecen cuando la tarea está **En progreso**. Pulsa [[Comenzar]] primero.",
              "**¿Es tuya?** Solo el responsable de la tarea puede entregarla. Comprueba el nombre en la columna de responsable.",
              "**¿Tiene subtareas abiertas?** Despliega la tarea: mientras quede una sin cerrar, la principal no se entrega.",
              "**¿Aparece [[Bloqueada]]?** Entonces depende de otra tarea o de una actividad de terceros. Pasa el cursor por la etiqueta para ver el motivo.",
              "**¿Estás en [[Kanban]]?** Esa vista es de solo lectura. Cambia a [[Lista]] o a [[Estructura]].",
            ],
          },
          {
            kind: "note",
            tone: "tip",
            text: "Si ninguna de las cinco lo explica, comprueba que estás en el equipo correcto con el desplegable de arriba: es fácil estar mirando otro equipo.",
          },
        ],
      },
      {
        id: "preguntas-frecuentes",
        title: "Preguntas frecuentes",
        summary: "Dudas que salen todo el tiempo, respondidas corto.",
        keywords: ["faq", "dudas", "preguntas"],
        blocks: [
          {
            kind: "table",
            head: ["Pregunta", "Respuesta"],
            rows: [
              [
                "Entregué sin querer, ¿puedo deshacerlo?",
                "Si creaste un entregable, puedes borrarlo mientras **no esté aprobado**. Si usaste [[Entregar sin adjunto]], la tarea quedó cerrada: pide a quien coordina que la reabra.",
              ],
              [
                "Me pidieron cambios, ¿creo otra entrega?",
                "No. Abre el entregable que ya existe y **añade una versión** (V2, V3…). Así queda el rastro de qué cambió.",
              ],
              [
                "No veo un proyecto en el que trabajo.",
                "Solo ves los proyectos donde eres integrante. Si falta uno, pide que te añadan.",
              ],
              [
                "La fecha de mi tarea cambió sola.",
                "Es la cadena de dependencias: al cerrarse la tarea de la que dependías, la tuya se reprograma para arrancar después. Te llega un aviso con la fecha nueva.",
              ],
              [
                "¿Dónde quedan los archivos que entrego?",
                "En [[Archivos]] del proyecto, dentro de la carpeta de tu equipo, marcados con la versión y el nombre de la tarea.",
              ],
              [
                "Me llegan demasiados avisos.",
                "Ajusta los cuatro interruptores en [[Configuración]] del equipo. Son independientes para cada equipo.",
              ],
              [
                "Soy líder, ¿puedo aprobar mi propia entrega?",
                "No. Si la tarea es tuya, la revisa otra persona con permiso en ese equipo o proyecto.",
              ],
            ],
          },
        ],
      },
      {
        id: "reportar",
        title: "Reportar un problema",
        summary: "Cómo avisar de un fallo o pedir una mejora.",
        keywords: ["feedback", "bug", "fallo", "sugerencia", "soporte"],
        blocks: [
          {
            kind: "p",
            text: "Si algo no funciona como esperabas o se te ocurre una mejora, hay un formulario dentro de la propia aplicación: ve a [[Configuración]] y usa el bloque de comentarios.",
          },
          {
            kind: "p",
            text: "Cuenta **qué hacías**, **qué esperabas** y **qué pasó**. Con eso basta para reproducirlo; sin eso casi nunca se puede.",
          },
          {
            kind: "note",
            tone: "info",
            text: "Cada vez que se publica una mejora verás un aviso de novedades al entrar, con el resumen de lo que cambió para tu rol.",
          },
        ],
      },
    ],
  },
];

/**
 * Temas a los que la propia aplicación enlaza («¿cómo se hace esto?» junto al
 * control que lo hace). Se centralizan aquí para que un cambio de `id` en el
 * contenido rompa el test que los valida, y no un enlace en silencio.
 */
export const MANUAL_TOPIC = {
  entregar: "entregar-tarea",
  bloqueada: "tarea-bloqueada",
  entregables: "entregables",
  misTareas: "mis-tareas-vista",
  archivos: "archivos-equipo",
  revisar: "revisar-entregas",
  video: "video",
} as const;

/** Todos los artículos en el orden del índice — alimenta «anterior / siguiente». */
export const MANUAL_ARTICLES = MANUAL_SECTIONS.flatMap((section) =>
  section.articles.map((article) => ({ section, article })),
);

/** El primer artículo: lo que se abre al entrar sin elegir tema. */
export const DEFAULT_ARTICLE_ID = MANUAL_ARTICLES[0].article.id;
