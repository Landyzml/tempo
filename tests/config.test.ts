import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const run = (url: string, key: string) =>
  spawnSync(process.execPath, ["scripts/check-config.mjs"], {
    env: {
      ...process.env,
      VITE_SUPABASE_URL: url,
      VITE_SUPABASE_PUBLISHABLE_KEY: key,
    },
    encoding: "utf8",
  });
test("production config gate rejects missing, placeholder, secret and service-role keys", () => {
  const url = "https://example.supabase.co";
  for (const key of [
    "",
    "sb_publishable_replace_me",
    "sb_secret_test",
    `header.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`,
  ])
    assert.notEqual(run(url, key).status, 0);
  assert.notEqual(
    run("http://localhost:54321", "sb_publishable_test_fixture").status,
    0,
  );
  assert.equal(run(url, "sb_publishable_test_fixture").status, 0);
});
