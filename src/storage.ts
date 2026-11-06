import type { RecordItem } from "./model";
const DB_NAME = "tempo-personal-v1";
let connection: Promise<IDBDatabase> | undefined;
function database() {
  if (!connection)
    connection = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () =>
        req.result.createObjectStore("records", { keyPath: "id" });
      req.onerror = () => {
        connection = undefined;
        reject(Error("无法打开浏览器数据库，请检查隐私模式或存储权限"));
      };
      req.onblocked = () => {
        connection = undefined;
        reject(Error("请关闭其他 Tempo 标签页后重试"));
      };
      req.onsuccess = () => {
        req.result.onversionchange = () => {
          req.result.close();
          connection = undefined;
        };
        resolve(req.result);
      };
    });
  return connection;
}
export async function closeStorage() {
  if (connection) (await connection).close();
  connection = undefined;
}
const validDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(s + "T12:00:00Z")) &&
  new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s;
const validTime = (s: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s);
export function validateRecord(value: unknown): RecordItem {
  if (!value || typeof value !== "object") throw Error("备份包含无效记录");
  const r = value as Record<string, unknown>;
  if (
    typeof r.id !== "string" ||
    !r.id ||
    r.id.length > 200 ||
    !["task", "event", "session"].includes(String(r.kind)) ||
    typeof r.title !== "string" ||
    !r.title.trim() ||
    r.title.length > 300
  )
    throw Error("记录 ID、类型或标题无效");
  for (const key of ["important", "urgent", "completed", "allDay"])
    if (r[key] !== undefined && typeof r[key] !== "boolean")
      throw Error("记录状态无效");
  for (const key of [
    "description",
    "due",
    "dueTime",
    "date",
    "start",
    "end",
    "taskId",
    "createdAt",
    "updatedAt",
    "completedAt",
    "color",
  ])
    if (r[key] !== undefined && typeof r[key] !== "string")
      throw Error("记录字段无效");
  const item: RecordItem = {
    id: r.id,
    kind: r.kind as RecordItem["kind"],
    title: r.title.trim(),
    description: String(r.description || ""),
    due: String(r.due || ""),
    dueTime: String(r.dueTime || ""),
    important: !!r.important,
    urgent: !!r.urgent,
    completed: !!r.completed,
    date: String(r.date || ""),
    start: String(r.start || ""),
    end: String(r.end || ""),
    allDay: !!r.allDay,
    color: String(r.color || "blue"),
    taskId: r.kind === "session" ? String(r.taskId || "") : undefined,
  };
  for (const key of ["createdAt", "updatedAt", "completedAt"] as const)
    if (r[key]) {
      if (Number.isNaN(Date.parse(String(r[key]))))
        throw Error("记录时间戳无效");
      item[key] = String(r[key]);
    }
  if (item.description!.length > 10000) throw Error("描述不能超过 10000 字");
  if (item.due && !validDate(item.due)) throw Error("截止日期无效");
  if (item.dueTime && (!item.due || !validTime(item.dueTime)))
    throw Error("截止时间需要有效的截止日期");
  if (item.kind !== "task") {
    if (!validDate(item.date!)) throw Error("日程日期无效");
    if (
      !item.allDay &&
      (!validTime(item.start!) ||
        !validTime(item.end!) ||
        item.end! <= item.start!)
    )
      throw Error("结束时间必须晚于开始时间");
    if (item.allDay) {
      item.start = "";
      item.end = "";
    }
    if (!["blue", "green", "orange"].includes(item.color!))
      throw Error("日程类别无效");
    if (item.kind === "session" && !item.taskId)
      throw Error("学习时段需要关联任务");
  }
  return item;
}
export function parseBackup(text: string): RecordItem[] {
  if (text.length > 10 * 1024 * 1024) throw Error("备份文件不能超过 10 MB");
  let v;
  try {
    v = JSON.parse(text);
  } catch {
    throw Error("不是有效的 JSON 备份");
  }
  if (
    v?.format !== "tempo-backup" ||
    v.version !== 1 ||
    !Array.isArray(v.records) ||
    v.records.length > 10000
  )
    throw Error("不支持的 Tempo 备份格式");
  const rows: RecordItem[] = v.records.map(validateRecord);
  const ids = new Set(rows.map((r) => r.id));
  if (ids.size !== rows.length) throw Error("备份包含重复 ID");
  for (const r of rows)
    if (
      r.kind === "session" &&
      !rows.some((t) => t.id === r.taskId && t.kind === "task")
    )
      throw Error("备份中的学习时段缺少关联任务");
  return rows;
}
function changed() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("tempo-records-changed"));
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(DB_NAME);
      channel.postMessage("changed");
      channel.close();
    }
  }
}
export function subscribeToChanges(callback: () => void) {
  window.addEventListener("tempo-records-changed", callback);
  const channel =
    typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel(DB_NAME)
      : undefined;
  if (channel) channel.onmessage = callback;
  return () => {
    window.removeEventListener("tempo-records-changed", callback);
    channel?.close();
  };
}
export async function loadRecords(): Promise<RecordItem[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readonly");
    const req = tx.objectStore("records").getAll();
    tx.oncomplete = () => resolve(req.result);
    tx.onabort = () => reject(Error("读取本地数据失败"));
    tx.onerror = () => reject(Error("读取本地数据失败"));
  });
}
async function mutate<T>(
  operation: (rows: RecordItem[], store: IDBObjectStore) => T,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readwrite");
    const store = tx.objectStore("records");
    let result: T, error: unknown;
    store.getAll().onsuccess = (event) => {
      try {
        result = operation(
          (event.target as IDBRequest<RecordItem[]>).result,
          store,
        );
      } catch (e) {
        error = e;
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      changed();
      resolve(result);
    };
    tx.onabort = () =>
      reject(error || Error("保存失败，浏览器存储可能已满。请先导出备份"));
    tx.onerror = () => {
      error = Error("浏览器存储写入失败，请检查可用空间");
    };
  });
}
export async function saveRecord(input: RecordItem) {
  const normalized = validateRecord({
    ...input,
    id: input.id || crypto.randomUUID(),
  });
  return mutate((rows, store) => {
    const old = rows.find((r) => r.id === normalized.id);
    if (old && old.kind !== normalized.kind) throw Error("不能改变记录类型");
    if (
      normalized.kind === "session" &&
      !rows.some((t) => t.id === normalized.taskId && t.kind === "task")
    )
      throw Error("关联任务不存在");
    const now = new Date().toISOString();
    const saved = {
      ...normalized,
      createdAt: old?.createdAt || now,
      updatedAt: now,
      completedAt: normalized.completed ? old?.completedAt || now : undefined,
    };
    store.put(saved);
    return saved;
  });
}
export async function deleteRecord(record: RecordItem) {
  await mutate((rows, store) => {
    store.delete(record.id);
    for (const r of rows) if (r.taskId === record.id) store.delete(r.id);
  });
}
export async function exportBackup() {
  return JSON.stringify(
    {
      format: "tempo-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      records: await loadRecords(),
    },
    null,
    2,
  );
}
export async function importBackup(text: string) {
  const incoming = parseBackup(text);
  return mutate((rows, store) => {
    const existing = new Map(rows.map((r) => [r.id, r]));
    const additions = incoming.filter((r) => !existing.has(r.id));
    const merged = [...rows, ...additions];
    for (const r of additions)
      if (
        r.kind === "session" &&
        !merged.some((t) => t.id === r.taskId && t.kind === "task")
      )
        throw Error("导入的学习时段关联无效");
    for (const r of additions) store.add(r);
    return {
      added: additions.length,
      skipped: incoming.length - additions.length,
    };
  });
}
