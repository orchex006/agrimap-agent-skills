import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Local repository + bare remote; no network. Deterministic identity/line endings.
export function gitIn(cwd, args, options = {}) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], ...options }).trim();
}

export async function initRepo(dir) {
  await mkdir(dir, { recursive: true });
  gitIn(dir, ["init", "-q", "-b", "main"]);
  for (const [key, value] of [["user.name", "AGM Test"], ["user.email", "agm@test.local"], ["commit.gpgsign", "false"], ["core.autocrlf", "false"]]) gitIn(dir, ["config", key, value]);
  return dir;
}

export async function createGitFixture(h, { name = "repo", branches = ["develop"], jenkins = false, files = {}, remote = true } = {}) {
  const repo = path.join(h.temp, name);
  const remotePath = path.join(h.temp, `${name}-remote.git`);
  await initRepo(repo);
  const all = { "README.md": "# fixture\n", ...(jenkins ? { Jenkinsfile: "pipeline {}\n", Jenkinsfile_Production: "pipeline {}\n" } : {}), ...files };
  for (const [file, content] of Object.entries(all)) {
    await mkdir(path.dirname(path.join(repo, file)), { recursive: true });
    await writeFile(path.join(repo, file), content, "utf8");
  }
  gitIn(repo, ["add", "--", ...Object.keys(all)]);
  gitIn(repo, ["commit", "-q", "-m", "chore: init"]);
  if (remote) {
    gitIn(h.temp, ["init", "-q", "--bare", "-b", "main", remotePath]);
    gitIn(repo, ["remote", "add", "origin", remotePath]);
    gitIn(repo, ["push", "-q", "origin", "main"]);
  }
  for (const branch of branches) {
    gitIn(repo, ["branch", branch]);
    if (remote) gitIn(repo, ["push", "-q", "origin", branch]);
  }
  if (remote) gitIn(repo, ["fetch", "-q", "origin"]);
  const git = args => gitIn(repo, args);
  return { repo, remote: remote ? remotePath : null, git };
}

// A second clone for simulating another developer pushing to the remote.
export async function cloneRemote(h, remotePath, name) {
  const dir = path.join(h.temp, name);
  gitIn(h.temp, ["clone", "-q", remotePath, dir]);
  for (const [key, value] of [["user.name", "Other"], ["user.email", "other@test.local"], ["commit.gpgsign", "false"], ["core.autocrlf", "false"]]) gitIn(dir, ["config", key, value]);
  return dir;
}
