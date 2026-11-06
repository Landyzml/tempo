import test from "node:test";
import assert from "node:assert/strict";
import {
  pageFromHash,
  routes,
  toDatabase,
  fromDatabase,
  recordTable,
} from "../src/model.ts";
test("all four hash URLs resolve and unknown routes recover to calendar", () => {
  for (const [page, path] of Object.entries(routes))
    assert.equal(pageFromHash("#" + path), page);
  assert.equal(pageFromHash(""), "日历");
  assert.equal(pageFromHash("#/unknown"), "日历");
});
test("a session update does not send deadline fields or create a task", () => {
  const row = toDatabase(
    {
      id: "session",
      kind: "session",
      taskId: "task",
      title: "Read",
      date: "2026-11-09",
      start: "09:00",
      end: "10:30",
    },
    "owner",
  );
  assert.equal(recordTable("session"), "calendar_entries");
  assert(!("due_date" in row));
  assert.equal("related_task_id" in row && row.related_task_id, "task");
});
test("date-only deadlines and times survive mapping without UTC conversion", () => {
  const r = fromDatabase(
    {
      id: "task",
      title: "Read",
      description: "",
      created_at: "now",
      due_date: "2026-11-09",
      due_time: "16:30:00",
    },
    true,
  );
  assert.equal(r.due, "2026-11-09");
  assert.equal(r.dueTime, "16:30");
  assert.equal(
    "due_date" in toDatabase(r, "u") && toDatabase(r, "u").due_date,
    "2026-11-09",
  );
});
test("all-day entries send null times and standalone events have no task", () => {
  const r = toDatabase(
    {
      id: "",
      kind: "event",
      title: "Rest",
      date: "2026-11-09",
      allDay: true,
      start: "09:00",
      end: "10:00",
    },
    "u",
  );
  assert("start_time" in r);
  assert.equal(r.start_time, null);
  assert.equal(r.end_time, null);
  assert.equal(r.related_task_id, null);
  assert(!("id" in r));
});
