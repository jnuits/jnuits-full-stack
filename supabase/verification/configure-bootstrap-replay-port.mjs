import { readFileSync, writeFileSync } from "node:fs";

export function configureDatabasePort(config, port) {
  const portText = String(port ?? "");
  const portNumber = Number(portText);
  if (
    !/^\d+$/.test(portText) ||
    !Number.isSafeInteger(portNumber) ||
    portNumber < 1024 ||
    portNumber > 65535
  ) {
    throw new Error(
      "SUPABASE_REPLAY_DB_PORT must be an integer from 1024 through 65535."
    );
  }

  const eol = config.includes("\r\n") ? "\r\n" : "\n";
  const hasFinalEol = config.endsWith("\n");
  const lines = config.split(/\r?\n/);
  let inDatabaseSection = false;
  let replacements = 0;

  const updated = lines.map((line) => {
    const section = /^\s*\[([^\]]+)\]\s*$/.exec(line);
    if (section) {
      inDatabaseSection = section[1] === "db";
      return line;
    }

    if (inDatabaseSection && /^\s*port\s*=/.test(line)) {
      replacements += 1;
      return `port = ${portNumber}`;
    }

    return line;
  });

  if (replacements !== 1) {
    throw new Error(
      `Expected exactly one port setting in [db], found ${replacements}.`
    );
  }

  let result = updated.join(eol);
  if (!hasFinalEol && result.endsWith(eol)) {
    result = result.slice(0, -eol.length);
  }
  return result;
}

function main() {
  const [configPath, port] = process.argv.slice(2);
  const config = readFileSync(configPath, "utf8");
  writeFileSync(configPath, configureDatabasePort(config, port), "utf8");
}

if (
  process.argv[1] &&
  process.argv[1].endsWith("configure-bootstrap-replay-port.mjs")
) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
