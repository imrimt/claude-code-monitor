import { execSync } from 'node:child_process';
import type { SessionSource } from '../types/index.js';

export interface DetectedProcess {
  pid: number;
  tty: string;
  cwd: string;
  source: SessionSource;
}

/**
 * Scan for running Codex CLI processes using `ps`.
 * Returns an array of detected processes with PID, TTY, CWD, and source.
 */
export function scanForCodexProcesses(): DetectedProcess[] {
  let psOutput: string;
  try {
    psOutput = execSync('ps -eo pid,tty,args', { encoding: 'utf-8', timeout: 5_000 });
  } catch {
    return [];
  }

  const results: DetectedProcess[] = [];
  const lines = psOutput.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Match lines where args contain 'codex' as a command
    // Format: "  PID TTY      ARGS..."
    const match = trimmed.match(/^(\d+)\s+(\S+)\s+(.+)$/);
    if (!match) continue;

    const [, pidStr, tty, args] = match;

    // Skip header line
    if (pidStr === 'PID') continue;

    // Check if this is a codex process (the CLI command)
    if (!isCodexProcess(args)) continue;

    // Skip our own monitor processes
    if (args.includes('claude-code-monitor') || args.includes('ccm')) continue;

    // Skip if no real TTY
    if (tty === '??' || tty === '?') continue;

    const pid = Number.parseInt(pidStr, 10);
    const ttyPath = normalizeTty(tty);
    const cwd = getProcessCwd(pid);

    if (cwd) {
      results.push({ pid, tty: ttyPath, cwd, source: 'codex' });
    }
  }

  return results;
}

/** Check if a process args string represents a Codex CLI process */
function isCodexProcess(args: string): boolean {
  // Match common patterns for codex CLI invocation:
  // - "codex ..." (direct binary)
  // - "node .../codex ..." (node running codex)
  // - "npx codex ..." (npx invocation)
  return /(?:^|\/)codex(?:\s|$)/.test(args) || /npx\s+codex(?:\s|$)/.test(args);
}

/** Normalize a TTY name from ps output to a /dev/ path */
function normalizeTty(tty: string): string {
  if (tty.startsWith('/dev/')) return tty;
  return `/dev/${tty}`;
}

/** Get the current working directory of a process via lsof */
export function getProcessCwd(pid: number): string | undefined {
  try {
    const output = execSync(`lsof -a -p ${pid} -d cwd -Fn`, {
      encoding: 'utf-8',
      timeout: 3_000,
    });
    // lsof -Fn output has lines like: "p<pid>\nn<path>"
    for (const line of output.split('\n')) {
      if (line.startsWith('n') && line.length > 1) {
        return line.slice(1);
      }
    }
  } catch {
    // Process may have exited or lsof not available
  }
  return undefined;
}
