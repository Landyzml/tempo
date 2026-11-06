export type RecordItem = {
  id: string;
  kind: "task" | "event" | "session";
  title: string;
  description?: string;
  due?: string;
  dueTime?: string;
  important?: boolean;
  urgent?: boolean;
  completed?: boolean;
  completedAt?: string;
  date?: string;
  start?: string;
  end?: string;
  allDay?: boolean;
  color?: string;
  taskId?: string;
  createdAt?: string;
};
export const routes = {
  概览: "/dashboard",
  今日: "/today",
  全部任务: "/tasks",
  日历: "/calendar",
} as const;
export type Page = keyof typeof routes;
export function pageFromHash(hash: string): Page {
  return (
    (Object.keys(routes) as Page[]).find((p) => "#" + routes[p] === hash) ||
    "日历"
  );
}
export function recordTable(kind: RecordItem["kind"]) {
  return kind === "task" ? "tasks" : "calendar_entries";
}
export function toDatabase(
  r: RecordItem,
  userId: string,
): Record<string, unknown> {
  const common = {
    ...(r.id ? { id: r.id } : {}),
    user_id: userId,
    title: r.title.trim(),
    description: r.description || "",
  };
  return r.kind === "task"
    ? {
        ...common,
        due_date: r.due || null,
        due_time: r.dueTime || null,
        important: !!r.important,
        manual_urgency: !!r.urgent,
        completed: !!r.completed,
      }
    : {
        ...common,
        kind: r.kind,
        event_date: r.date,
        start_time: r.allDay ? null : r.start,
        end_time: r.allDay ? null : r.end,
        all_day: !!r.allDay,
        color: r.color || "blue",
        related_task_id: r.kind === "session" ? r.taskId : null,
      };
}
export type DatabaseRow = {
  id: string;
  title: string;
  description: string;
  created_at: string;
  due_date?: string | null;
  due_time?: string | null;
  important?: boolean;
  manual_urgency?: boolean;
  completed?: boolean;
  completed_at?: string | null;
  kind?: "event" | "session";
  event_date?: string;
  start_time?: string | null;
  end_time?: string | null;
  all_day?: boolean;
  color?: string;
  related_task_id?: string | null;
};
export function fromDatabase(r: DatabaseRow, task: boolean): RecordItem {
  return {
    id: r.id,
    kind: task ? "task" : r.kind!,
    title: r.title,
    description: r.description,
    createdAt: r.created_at,
    ...(task
      ? {
          due: r.due_date || "",
          dueTime: r.due_time?.slice(0, 5) || "",
          important: r.important,
          urgent: r.manual_urgency,
          completed: r.completed,
          completedAt: r.completed_at || undefined,
        }
      : {
          date: r.event_date,
          start: r.start_time?.slice(0, 5) || "",
          end: r.end_time?.slice(0, 5) || "",
          allDay: r.all_day,
          color: r.color,
          taskId: r.related_task_id || undefined,
        }),
  };
}
