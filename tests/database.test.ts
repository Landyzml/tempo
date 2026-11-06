import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";
const A = "00000000-0000-4000-8000-000000000001",
  B = "00000000-0000-4000-8000-000000000002";
const T = "10000000-0000-4000-8000-000000000001",
  S = "20000000-0000-4000-8000-000000000001";
test("PostgreSQL migration: RLS, validation, ownership, sessions, timestamps and cascade", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create schema auth; create role anon nologin; create role authenticated nologin; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated; insert into auth.users values('${A}'),('${B}');`,
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202611060001_tempo.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${A}';`);
    await db.exec(
      `insert into tasks(id,title,due_date) values('${T}','Study','2026-11-10');insert into calendar_entries(id,kind,title,event_date,start_time,end_time,related_task_id) values('${S}','session','Study session','2026-11-09','09:00','10:00','${T}');`,
    );
    await db.exec(
      `update tasks set due_date='2026-11-12',completed=true where id='${T}';`,
    );
    const task = (
      await db.query<{ completed_at: string | null }>(
        `select completed_at from tasks where id='${T}'`,
      )
    ).rows[0];
    assert(task.completed_at);
    const before = (
      await db.query<{ created_at: string }>(
        `select created_at from tasks where id='${T}'`,
      )
    ).rows[0].created_at;
    await db.exec(
      `update tasks set completed=false,created_at='2000-01-01' where id='${T}';`,
    );
    const after = (
      await db.query<{ completed_at: string | null; created_at: string }>(
        `select completed_at,created_at from tasks where id='${T}'`,
      )
    ).rows[0];
    assert.equal(after.completed_at, null);
    assert.equal(String(after.created_at), String(before));
    assert.equal(
      (
        await db.query<{ d: string }>(
          `select event_date::text as d from calendar_entries where id='${S}'`,
        )
      ).rows[0].d,
      "2026-11-09",
    );
    await assert.rejects(
      db.exec(
        `insert into calendar_entries(kind,title,event_date,start_time,end_time) values('event','Invalid','2026-11-09','11:00','10:00')`,
      ),
    );
    await assert.rejects(
      db.exec(
        `insert into calendar_entries(kind,title,event_date,all_day,related_task_id) values('session','Orphan','2026-11-09',true,'99999999-0000-4000-8000-000000000001')`,
      ),
    );
    await assert.rejects(
      db.exec(`insert into tasks(title,user_id) values('Spoof','${B}')`),
    );
    await assert.rejects(
      db.exec(`update tasks set user_id='${B}' where id='${T}'`),
    );
    await db.exec(`set request.jwt.claim.sub='${B}'`);
    assert.equal((await db.query("select * from tasks")).rows.length, 0);
    assert.equal(
      (await db.query("select * from calendar_entries")).rows.length,
      0,
    );
    await assert.rejects(
      db.exec(
        `insert into calendar_entries(kind,title,event_date,all_day,related_task_id) values('session','Cross owner','2026-11-09',true,'${T}')`,
      ),
    );
    assert.equal(
      (
        await db.query(
          `update tasks set title='Stolen' where id='${T}' returning id`,
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (await db.query(`delete from tasks where id='${T}' returning id`)).rows
        .length,
      0,
    );
    await db.exec(
      `set request.jwt.claim.sub='${A}';delete from tasks where id='${T}'`,
    );
    assert.equal(
      (await db.query("select * from calendar_entries")).rows.length,
      0,
    );
    await db.exec("reset role;set role anon");
    await assert.rejects(db.exec("select * from tasks"));
  } finally {
    await db.close();
  }
});
