import { createClient } from "@supabase/supabase-js";
import {
  fromDatabase,
  toDatabase,
  recordTable,
  type RecordItem,
  type DatabaseRow,
} from "./model";
const url = import.meta.env.VITE_SUPABASE_URL || "";
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
function publicKey(value: string) {
  if (value.startsWith("sb_publishable_")) return true;
  try {
    return (
      JSON.parse(
        atob(value.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      ).role === "anon"
    );
  } catch {
    return false;
  }
}
export const configured =
  /^https:\/\//.test(url) &&
  !url.includes("your-project") &&
  publicKey(key) &&
  !key.includes("replace_me");
export const supabase = configured
  ? createClient(url, key, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
export const callbackUrl = () =>
  new URL(import.meta.env.BASE_URL, window.location.origin).href;
function client() {
  if (!supabase) throw Error("请先配置 Supabase");
  return supabase;
}
export async function loadRecords(): Promise<RecordItem[]> {
  const c = client();
  const [tasks, entries] = await Promise.all([
    c.from("tasks").select("*").order("created_at"),
    c.from("calendar_entries").select("*").order("created_at"),
  ]);
  if (tasks.error) throw tasks.error;
  if (entries.error) throw entries.error;
  return [
    ...(tasks.data as DatabaseRow[]).map((r) => fromDatabase(r, true)),
    ...(entries.data as DatabaseRow[]).map((r) => fromDatabase(r, false)),
  ];
}
export async function saveRecord(r: RecordItem): Promise<RecordItem> {
  const c = client();
  const {
    data: { user },
    error,
  } = await c.auth.getUser();
  if (error || !user) throw Error("登录已过期，请重新登录");
  const payload = toDatabase(r, user.id);
  const query = r.id
    ? c.from(recordTable(r.kind)).update(payload).eq("id", r.id)
    : c.from(recordTable(r.kind)).insert(payload);
  const result = await query.select("*").single();
  if (result.error) throw result.error;
  return fromDatabase(result.data as DatabaseRow, r.kind === "task");
}
export async function deleteRecord(r: RecordItem) {
  const result = await client()
    .from(recordTable(r.kind))
    .delete()
    .eq("id", r.id)
    .select("id");
  if (result.error) throw result.error;
  if (!result.data?.length) throw Error("记录不存在或没有删除权限");
}
