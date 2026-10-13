import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const execute = promisify(execFile);
const defaults = [".github/workflows/quality-gate.yml", ".github/workflows/diff-check.yml", ".github/workflows/semgrep.yml", "dynamic/github-code-scanning/codeql"];
const productionPath = ".github/workflows/production-browser-smoke.yml";

export function classifyRuns(runs, { sha, requiredPaths = defaults }) {
  const latest = new Map();
  const matched = [];
  const attemptTime = run => {
    for (const field of ["run_started_at", "updated_at", "created_at"]) {
      const time = Date.parse(run[field]);
      if (Number.isFinite(time)) return time;
    }
    return null;
  };
  for (const run of runs) {
    if (run.head_sha !== sha) continue;
    const path = String(run.path).split("@")[0];
    if (!requiredPaths.includes(path) && path !== productionPath) continue;
    matched.push(run);
    const previous = latest.get(path);
    const started = attemptTime(run);
    const previousStarted = previous ? attemptTime(previous) : null;
    // Reruns retain their original ID. Compare attempt start times, not ID or
    // completion time, so a slower earlier green run cannot hide a new failure.
    if (!previous || (started !== null && previousStarted !== null && started !== previousStarted
      ? started > previousStarted : run.id > previous.id)) latest.set(path, run);
  }
  const selected = [...latest.values()];
  // A required rerun still executing must never be hidden by a green sibling.
  for (const run of matched) if (run.status !== "completed" && !selected.includes(run)) selected.push(run);
  const missing = requiredPaths.filter(path => !latest.has(path));
  const waiting = selected.filter(run => ["waiting", "action_required"].includes(run.status) || run.conclusion === "action_required");
  const failed = selected.filter(run => run.status === "completed" && run.conclusion !== "success" && run.conclusion !== "action_required");
  const running = selected.filter(run => run.status !== "completed");
  const state = failed.length ? "failed" : waiting.length ? "attention" : missing.length || running.length ? "waiting" : "complete";
  return { state, missing, failed, waiting, runs: selected };
}

export async function watchActions(options, io) {
  const now = io.now ?? Date.now;
  const sleep = io.sleep ?? (delay => new Promise(resolve => setTimeout(resolve, delay)));
  const start = now();
  const intervalMs = options.intervalMs ?? 60_000;
  const timeoutMs = options.timeoutMs ?? 3_600_000;
  for (;;) {
    let report;
    try {
      report = classifyRuns(await io.read(), options);
    } catch {
      report = { state: "unavailable", missing: [], failed: [], waiting: [], runs: [] };
    }
    if (report.state === "waiting" && now() - start >= timeoutMs) report.state = "timeout";
    if (report.state !== "waiting") {
      report.sha = options.sha;
      report.startedAt = new Date(start).toISOString();
      report.finishedAt = new Date(now()).toISOString();
      await io.save(report);
      return report;
    }
    await sleep(Math.min(intervalMs, Math.max(1, timeoutMs - (now() - start))));
  }
}

async function github(args) {
  const result = await execute("gh", ["api", ...args], { maxBuffer: 12_000_000, timeout: 30_000, windowsHide: true });
  return JSON.parse(result.stdout);
}

function parseArgs(args) {
  const options = { repo: "jnuits/jnuits-full-stack", intervalMs: 60_000, timeoutMs: 3_600_000, notify: false, production: false };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === "--notify") options.notify = true;
    else if (flag === "--production") options.production = true;
    else if (["--sha", "--repo", "--interval-seconds", "--timeout-minutes"].includes(flag)) {
      const value = args[++index];
      if (!value) throw new Error("Missing option value.");
      if (flag === "--sha") options.sha = value;
      if (flag === "--repo") options.repo = value;
      if (flag === "--interval-seconds") options.intervalMs = Number(value) * 1000;
      if (flag === "--timeout-minutes") options.timeoutMs = Number(value) * 60_000;
    } else throw new Error("Unknown option.");
  }
  if (!/^[a-f0-9]{40}$/.test(options.sha ?? "")) throw new Error("--sha must be a full commit SHA.");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(options.repo)) throw new Error("Invalid repository.");
  if (!Number.isInteger(options.intervalMs) || options.intervalMs < 10_000 || options.intervalMs > 300_000) throw new Error("Polling interval must be 10 to 300 seconds.");
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 60_000 || options.timeoutMs > 14_400_000) throw new Error("Timeout must be 1 to 240 minutes.");
  options.requiredPaths = [...defaults, ...(options.production ? [productionPath] : [])];
  return options;
}

function notify(state) {
  if (process.platform !== "win32") return;
  // Fixed code and allowlisted state; no shell interpolation of API/user text.
  const allowed = ["complete", "failed", "attention", "timeout", "unavailable"];
  if (!allowed.includes(state)) return;
  const code = 'Add-Type -AssemblyName System.Windows.Forms; $notice = New-Object System.Windows.Forms.NotifyIcon; $notice.Icon = [System.Drawing.SystemIcons]::Information; $notice.Visible = $true; $notice.ShowBalloonTip(10000, "JnUITS Actions", "CI report ready: " + $env:JNUITS_CI_NOTICE_STATE, [System.Windows.Forms.ToolTipIcon]::Info); Start-Sleep -Seconds 12; $notice.Dispose()';
  const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", code], { detached: true, windowsHide: true, stdio: "ignore", env: { ...process.env, JNUITS_CI_NOTICE_STATE: state } });
  child.on("error", () => { /* Desktop notifications are best effort; the report is authoritative. */ });
  child.unref();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const directory = resolve("artifacts/reports");
  await mkdir(directory, { recursive: true });
  const output = join(directory, `ci-completion-${options.sha}.json`);
  // A restarted watcher must not leave an older terminal report looking current.
  // The target is only this helper's exact managed filename for the validated SHA.
  await unlink(output).catch(error => { if (error.code !== "ENOENT") throw error; });
  const report = await watchActions(options, {
    read: async () => {
      const pages = await github([`repos/${options.repo}/actions/runs?head_sha=${options.sha}&per_page=100`, "--paginate", "--slurp"]);
      return pages.flatMap(page => page.workflow_runs).map(run => ({ id: run.id, name: run.name, path: run.path, status: run.status, conclusion: run.conclusion, head_sha: run.head_sha, run_attempt: run.run_attempt, run_started_at: run.run_started_at, updated_at: run.updated_at, created_at: run.created_at }));
    },
    save: async value => {
      value.repository = options.repo;
      value.runs = value.runs.map(run => ({ ...run, url: `https://github.com/${options.repo}/actions/runs/${run.id}` }));
      // Provider statuses are reported separately; a pending Vercel status is not an Actions runner wait.
      try {
        const status = await github([`repos/${options.repo}/commits/${options.sha}/status`]);
        value.providers = status.statuses.map(({ context, state, description }) => ({ context, state, description }));
      } catch { value.providersUnavailable = true; }
      if (value.state === "attention") {
        value.approvals = [];
        for (const run of value.waiting) {
          try {
            const approvals = await github([`repos/${options.repo}/actions/runs/${run.id}/pending_deployments`]);
            value.approvals.push(...approvals.map(item => ({ runId: run.id, environment: item.environment?.name, currentUserCanApprove: item.current_user_can_approve })));
          } catch { value.approvalsUnavailable = true; }
        }
      }
      const temporary = output + "." + randomUUID() + ".tmp";
      await writeFile(temporary, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
      await rename(temporary, output);
    },
  });
  console.log(`Actions ${report.state} for ${options.sha.slice(0, 12)}. Report: ${output}`);
  if (options.notify) notify(report.state);
  process.exitCode = { complete: 0, failed: 1, attention: 2, timeout: 3, unavailable: 4 }[report.state];
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error("Actions watcher could not start or save its report. Check arguments, gh authentication, and local file access."); process.exitCode = 4; });
}
