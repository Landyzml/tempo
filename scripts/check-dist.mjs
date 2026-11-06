import { readFile, stat, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
const html = await readFile("dist/index.html", "utf8");
const assets = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map((m) => m[1]);
assert(assets.length > 0, "No emitted assets");
for (const path of assets) {
  assert(path.startsWith("/tempo/"), "Asset outside /tempo/: " + path);
  await stat("dist/" + path.slice("/tempo/".length));
}
const names = await readdir("dist");
assert(
  !names.includes("server") && !names.includes(".openai"),
  "Server deployment artifacts in static output",
);
assert(!html.includes("/src/main.tsx"), "Unbuilt source entry");
console.log(
  "PASS: /tempo/ asset paths resolve; dist contains a static frontend, no server bundle.",
);
