import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import {
  saveRecord,
  loadRecords,
  deleteRecord,
  closeStorage,
  exportBackup,
  importBackup,
  parseBackup,
} from "../src/storage.ts";
test("IndexedDB saves survive reopening, sessions preserve deadlines, timestamps and cascade are consistent", async () => {
  const t = await saveRecord({
    id: "",
    kind: "task",
    title: "Study",
    due: "2026-11-20",
  });
  const s = await saveRecord({
    id: "",
    kind: "session",
    title: "Read",
    taskId: t.id,
    date: "2026-11-17",
    start: "18:00",
    end: "19:30",
  });
  await closeStorage();
  assert.equal(
    (await loadRecords()).find((r) => r.id === t.id)?.due,
    "2026-11-20",
  );
  await saveRecord({ ...s, date: "2026-11-18" });
  assert.equal(
    (await loadRecords()).find((r) => r.id === t.id)?.due,
    "2026-11-20",
  );
  const done = await saveRecord({ ...t, completed: true });
  assert(done.completedAt);
  assert.equal(done.createdAt, t.createdAt);
  const undone = await saveRecord({ ...done, completed: false });
  assert.equal(undone.completedAt, undefined);
  await deleteRecord(t);
  assert(!(await loadRecords()).some((r) => r.id === s.id));
});
test("backup restore is validated, additive, idempotent and preserves local edits", async () => {
  const t = await saveRecord({
    id: "",
    kind: "task",
    title: "Original",
    due: "2026-11-12",
  });
  const e = await saveRecord({
    id: "",
    kind: "event",
    title: "Event",
    date: "2026-11-11",
    start: "09:00",
    end: "10:00",
  });
  const text = await exportBackup();
  assert(parseBackup(text).some((r) => r.id === e.id));
  await saveRecord({ ...t, title: "Local edit" });
  let result = await importBackup(text);
  assert.equal(result.added, 0);
  assert.equal(
    (await loadRecords()).find((r) => r.id === t.id)?.title,
    "Local edit",
  );
  await deleteRecord(t);
  await deleteRecord(e);
  result = await importBackup(text);
  assert.equal(result.added, 2);
  await closeStorage();
  assert.equal(
    (await loadRecords()).find((r) => r.id === t.id)?.title,
    "Original",
  );
  await deleteRecord(t);
  await deleteRecord(e);
});
test("invalid backups and dangling links cannot change saved records", async () => {
  const before = await loadRecords();
  for (const text of [
    "not json",
    JSON.stringify({ format: "tempo-backup", version: 99, records: [] }),
    JSON.stringify({
      format: "tempo-backup",
      version: 1,
      records: [
        {
          id: "s",
          kind: "session",
          title: "Orphan",
          date: "2026-11-10",
          start: "09:00",
          end: "10:00",
          taskId: "missing",
        },
      ],
    }),
  ])
    await assert.rejects(importBackup(text));
  await assert.rejects(
    saveRecord({
      id: "",
      kind: "event",
      title: "Invalid time",
      date: "2026-11-10",
      start: "11:00",
      end: "10:00",
    }),
  );
  await assert.rejects(
    saveRecord({
      id: "",
      kind: "task",
      title: "Invalid date",
      due: "2026-02-30",
    }),
  );
  assert.deepEqual(await loadRecords(), before);
  await closeStorage();
});
