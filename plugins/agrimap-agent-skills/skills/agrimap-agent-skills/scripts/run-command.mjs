// Process runner shared by the governance scripts. Arguments are always an
// argv array passed to execFileSync; no shell string is ever composed.
import { execFileSync } from "node:child_process";

export function defaultRun(command, args = [], { cwd, input, env } = {}) {
  try {
    const stdout = execFileSync(command, args, {
      cwd,
      input,
      env: env ? { ...process.env, ...env } : process.env,
      encoding: "utf8",
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    });
    return { ok: true, status: 0, stdout: stdout ?? "", stderr: "" };
  } catch (error) {
    return {
      ok: false,
      status: typeof error?.status === "number" ? error.status : null,
      stdout: String(error?.stdout ?? ""),
      stderr: String(error?.stderr ?? error?.message ?? ""),
    };
  }
}

export function gitRunner(run = defaultRun) {
  return (root, args, options = {}) => run("git", args, { ...options, cwd: root });
}

// Bounded, credential-free stderr for results and audit messages.
export function trimStderr(value, limit = 2048) {
  const text = String(value || "")
    .replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, "$1[REDACTED]@")
    .trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}
