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
  updatedAt?: string;
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
