import { readFileSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { configureDatabasePort } from "./configure-bootstrap-replay-port.mjs";

export function disableReplayCatalogCache(config) {
  let inCacheSection = false; let count = 0;
  const updated = config.split(/(\r?\n)/).map(line => {
    const section = /^\s*\[([^\]]+)\]\s*$/.exec(line);
    if (section) inCacheSection = section[1] === "experimental.pgdelta";
    if (inCacheSection && /^\s*enabled\s*=/.test(line)) {
      count += 1;
      return "enabled = false";
    }
    return line;
  }).join("");
  if (count !== 1) throw new Error(`Expected one experimental.pgdelta setting, found ${count}.`);
  return updated;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [configPath, scratchRoot, port] = process.argv.slice(2);
  const target = resolve(configPath ?? "");
  const root = resolve(scratchRoot ?? "");
  // No linked/project config or production setting may be changed here.
  if (!target.startsWith(`${root}${sep}replay.`) || !target.endsWith(`${sep}supabase${sep}config.toml`)) {
    throw new Error("Only a bootstrap replay scratch configuration is accepted.");
  }
  let config = disableReplayCatalogCache(readFileSync(target, "utf8"));
  if (port) config = configureDatabasePort(config, port);
  writeFileSync(target, config, "utf8");
}
