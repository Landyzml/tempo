import { loadEnv } from "vite";
const env = {
  ...loadEnv("production", process.cwd(), "VITE_"),
  ...process.env,
};
const url = env.VITE_SUPABASE_URL || "",
  key = env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
let validKey = key.startsWith("sb_publishable_") && !key.includes("replace_me");
try {
  const claims = JSON.parse(
    Buffer.from(key.split(".")[1], "base64url").toString(),
  );
  validKey = claims.role === "anon";
} catch {
  /* Publishable keys are opaque, not JWTs. */
}
if (
  !/^https:\/\/[a-z0-9.-]+(?::\d+)?\/?$/i.test(url) ||
  url.includes("your-project") ||
  !validKey ||
  key.startsWith("sb_secret_")
) {
  console.error(
    "Missing or invalid Supabase public configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY. Secret/service-role keys are forbidden.",
  );
  process.exit(1);
}
console.log(
  "Public backend configuration syntax is valid (connectivity is not tested).",
);
