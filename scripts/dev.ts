import { execFileSync } from "node:child_process";
import { resolve, sep } from "node:path";

const root = resolve(import.meta.dir, "..");
const apiPort = 3001;
const webPort = 5173;
const strayWebPorts = [5174, 5175, 5176, 5177, 5178, 5179];

type ProcessRow = { pid: number; ppid: number; command: string };

function commandOutput(file: string, args: string[]) {
  try {
    return execFileSync(file, args, { encoding: "utf8" });
  } catch (error) {
    const stdout = (error as { stdout?: unknown }).stdout;
    return typeof stdout === "string" ? stdout : "";
  }
}

function processRows() {
  return commandOutput("ps", ["-axww", "-o", "pid=,ppid=,command="]).split("\n").flatMap(line => {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+([\s\S]+)$/);
    if (!match) return [];
    const row: ProcessRow = { pid: Number(match[1]), ppid: Number(match[2]), command: match[3] };
    return [row];
  });
}

function processCwd(pid: number) {
  const lines = commandOutput("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"]).split("\n");
  const cwdIndex = lines.findIndex(line => line.startsWith("fcwd"));
  return lines.slice(cwdIndex + 1).find(line => line.startsWith("n"))?.slice(1) ?? "";
}

function isProjectDev(row: ProcessRow) {
  if (row.command.includes(`${root}${sep}node_modules`) && row.command.includes("vite")) return true;
  if (!/scripts\/dev\.ts|server\/index\.ts|\bbun run dev(?::web)?\b/.test(row.command)) return false;
  return processCwd(row.pid) === root;
}

function ancestorPids(rows: ProcessRow[], pid: number) {
  const byPid = new Map(rows.map(row => [row.pid, row]));
  const found = new Set<number>();
  let current = byPid.get(pid);
  while (current && !found.has(current.pid)) {
    found.add(current.pid);
    current = byPid.get(current.ppid);
  }
  return found;
}

function listeners(port: number) {
  return [...new Set(commandOutput("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]).split(/\s+/).map(Number).filter(pid => Number.isInteger(pid) && pid > 0))];
}

function signal(pid: number, signal: NodeJS.Signals) {
  try {
    process.kill(pid, signal);
  } catch {
    // The process already exited.
  }
}

async function stopPreviousDevServers() {
  const rows = processRows();
  const protectedPids = ancestorPids(rows, process.pid);
  protectedPids.add(process.pid);
  protectedPids.add(process.ppid);
  const leftovers = rows.filter(row => isProjectDev(row) && !protectedPids.has(row.pid));
  if (leftovers.length === 0) return;
  console.log("Stopping the previous social-web dev server.");
  for (const row of leftovers) signal(row.pid, "SIGTERM");
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const alive = processRows().some(row => leftovers.some(item => item.pid === row.pid));
    if (!alive) return;
    await Bun.sleep(50);
  }
  const stillAlive = new Set(processRows().map(row => row.pid));
  for (const row of leftovers) if (stillAlive.has(row.pid)) signal(row.pid, "SIGKILL");
}

function requireFree(port: number) {
  const pids = listeners(port);
  if (pids.length === 0) return;
  const rows = processRows();
  const details = pids.map(pid => {
    const command = rows.find(row => row.pid === pid)?.command ?? "unknown";
    return `${pid} ${command.slice(0, 160)}`;
  }).join("; ");
  console.error(`Port ${port} is already used by another program (${details}).`);
  process.exit(1);
}

async function accepts(url: string) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(400) });
      return true;
    } catch {
      await Bun.sleep(100);
    }
  }
  return false;
}

await stopPreviousDevServers();
const rows = processRows();
for (const port of strayWebPorts) {
  for (const pid of listeners(port)) {
    const row = rows.find(item => item.pid === pid);
    if (row && isProjectDev(row)) signal(pid, "SIGKILL");
  }
}
requireFree(apiPort);
requireFree(webPort);

const api = Bun.spawn(["bun", "--watch", "server/index.ts"], { cwd: root, stdout: "inherit", stderr: "inherit" });
const web = Bun.spawn(["bun", "run", "dev:web"], { cwd: root, stdout: "inherit", stderr: "inherit" });
let stopping: Promise<never> | undefined;

function stop(code: number): Promise<never> {
  stopping ??= (async () => {
    api.kill();
    web.kill();
    await Promise.race([Promise.all([api.exited, web.exited]), Bun.sleep(2000)]);
    if (api.exitCode === null) api.kill("SIGKILL");
    if (web.exitCode === null) web.kill("SIGKILL");
    process.exit(code);
  })();
  return stopping;
}

process.on("SIGINT", () => void stop(0));
process.on("SIGTERM", () => void stop(0));
process.on("SIGHUP", () => void stop(0));

const [apiReady, webReady] = await Promise.all([
  accepts(`http://127.0.0.1:${apiPort}/`),
  accepts(`http://127.0.0.1:${webPort}/`),
]);
if (!apiReady || !webReady) {
  console.error(`Dev server did not stay on http://127.0.0.1:${webPort} and http://127.0.0.1:${apiPort}.`);
  await stop(1);
}

const exitCode = await Promise.race([
  api.exited.then(code => code ?? 1),
  web.exited.then(code => code ?? 1),
]);
await stop(exitCode);
