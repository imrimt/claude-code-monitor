#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { Command } from 'commander';
import { render } from 'ink';
import { Dashboard } from '../components/Dashboard.js';
import { handleHookEvent } from '../hook/handler.js';
import { isHooksConfigured, setupHooks } from '../setup/index.js';
import { clearSessions, getSessions } from '../store/file-store.js';
import { getStatusDisplay } from '../utils/status.js';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as { version: string };

// Alternate screen buffer escape sequences
const ENTER_ALT_SCREEN = '\x1b[?1049h\x1b[H';
const EXIT_ALT_SCREEN = '\x1b[?1049l';

/**
 * Get TTY from ancestor processes
 */
const MAX_ANCESTOR_DEPTH = 5;

function getTtyFromAncestors(): string | undefined {
  try {
    let currentPid = process.ppid;
    for (let i = 0; i < MAX_ANCESTOR_DEPTH; i++) {
      const ttyName = execFileSync('ps', ['-o', 'tty=', '-p', String(currentPid)], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();
      const isValidTty = ttyName && ttyName !== '??' && ttyName !== '';
      if (isValidTty) {
        return `/dev/${ttyName}`;
      }
      const ppid = execFileSync('ps', ['-o', 'ppid=', '-p', String(currentPid)], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();
      if (!ppid) break;
      currentPid = parseInt(ppid, 10);
    }
  } catch {
    // TTY取得失敗は正常（バックグラウンド実行時など）
  }
  return undefined;
}

/**
 * Run TUI with alternate screen buffer
 */
async function runWithAltScreen(renderFn: () => ReturnType<typeof render>) {
  process.stdout.write(ENTER_ALT_SCREEN);
  const { waitUntilExit } = renderFn();
  try {
    await waitUntilExit();
  } finally {
    process.stdout.write(EXIT_ALT_SCREEN);
  }
}

const program = new Command();

program
  .name('ccm')
  .description('Claude Code Monitor - CLI-based session monitoring')
  .version(pkg.version);

program
  .command('watch')
  .alias('w')
  .description('Start the monitoring TUI')
  .action(async () => {
    await runWithAltScreen(() => render(<Dashboard />));
  });

program
  .command('hook <event>')
  .description('Handle a hook event from Claude Code (internal use)')
  .action(async (event: string) => {
    try {
      const tty = getTtyFromAncestors();
      await handleHookEvent(event, tty);
    } catch (e) {
      console.error('Hook error:', e);
      process.exit(1);
    }
  });

program
  .command('list')
  .alias('ls')
  .description('List all sessions')
  .action(() => {
    const sessions = getSessions();
    if (sessions.length === 0) {
      console.log('No active sessions');
      return;
    }
    for (const session of sessions) {
      const cwd = session.cwd.replace(/^\/Users\/[^/]+/, '~');
      const { symbol } = getStatusDisplay(session.status);
      console.log(`${symbol} ${cwd}`);
    }
  });

program
  .command('clear')
  .description('Clear all sessions')
  .action(() => {
    clearSessions();
    console.log('Sessions cleared');
  });

program
  .command('setup')
  .description('Setup Claude Code hooks for monitoring')
  .action(async () => {
    await setupHooks();
  });

/**
 * Default action (when launched without arguments)
 * - Run setup if not configured
 * - Launch monitor if already configured
 */
async function defaultAction() {
  if (!isHooksConfigured()) {
    console.log('Initial setup required.\n');
    await setupHooks();

    // Verify setup was completed
    if (!isHooksConfigured()) {
      // Setup was cancelled
      return;
    }
    console.log('');
  }

  // Launch monitor
  await runWithAltScreen(() => render(<Dashboard />));
}

// Default action when executed without commands
if (process.argv.length === 2) {
  defaultAction().catch(console.error);
} else {
  program.parse();
}
