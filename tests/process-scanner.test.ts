import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_STORE_DIR = join(tmpdir(), `claude-monitor-test-ps-${process.pid}`);

vi.mock('node:os', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:os')>();
  return {
    ...original,
    homedir: () => join(tmpdir(), `claude-monitor-test-ps-${process.pid}`),
  };
});

vi.mock('../src/utils/tab-name.js', () => ({
  enrichSessionsWithTabNames: (sessions: unknown[]) => sessions,
}));

vi.mock('../src/utils/tty-cache.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/utils/tty-cache.js')>();
  return {
    ...original,
    isTtyAlive: (tty: string | undefined) => {
      if (!tty) return true;
      if (tty === '/dev/ttys999') return false;
      return true;
    },
  };
});

vi.mock('node:child_process', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:child_process')>();
  return {
    ...original,
    execSync: vi.fn(original.execSync),
  };
});

const mockedExecSync = vi.mocked(execSync);

describe('process-scanner', () => {
  beforeEach(async () => {
    const { resetStoreCache } = await import('../src/store/file-store.js');
    resetStoreCache();

    if (existsSync(TEST_STORE_DIR)) {
      rmSync(TEST_STORE_DIR, { recursive: true, force: true });
    }

    mockedExecSync.mockReset();
  });

  afterEach(async () => {
    const { flushPendingWrites, resetStoreCache } = await import('../src/store/file-store.js');
    flushPendingWrites();
    resetStoreCache();

    vi.restoreAllMocks();
    if (existsSync(TEST_STORE_DIR)) {
      rmSync(TEST_STORE_DIR, { recursive: true, force: true });
    }
  });

  describe('scanForCodexProcesses', () => {
    it('should return empty array when ps fails', async () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('ps failed');
      });

      const { scanForCodexProcesses } = await import('../src/utils/process-scanner.js');
      const result = scanForCodexProcesses();
      expect(result).toEqual([]);
    });

    it('should return empty array when no codex processes found', async () => {
      mockedExecSync.mockImplementation((cmd) => {
        if (typeof cmd === 'string' && cmd.startsWith('ps ')) {
          return '  PID TTY      ARGS\n  123 ttys001  node /usr/bin/some-other-tool\n';
        }
        return '';
      });

      const { scanForCodexProcesses } = await import('../src/utils/process-scanner.js');
      const result = scanForCodexProcesses();
      expect(result).toEqual([]);
    });

    it('should detect codex process with direct binary', async () => {
      mockedExecSync.mockImplementation((cmd) => {
        if (typeof cmd === 'string' && cmd.startsWith('ps ')) {
          return '  PID TTY      ARGS\n 5678 ttys003  codex --model o4-mini\n';
        }
        if (typeof cmd === 'string' && cmd.startsWith('lsof ')) {
          return 'p5678\nn/Users/dev/project\n';
        }
        return '';
      });

      const { scanForCodexProcesses } = await import('../src/utils/process-scanner.js');
      const result = scanForCodexProcesses();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        pid: 5678,
        tty: '/dev/ttys003',
        cwd: '/Users/dev/project',
        source: 'codex',
      });
    });

    it('should detect codex process run via npx', async () => {
      mockedExecSync.mockImplementation((cmd) => {
        if (typeof cmd === 'string' && cmd.startsWith('ps ')) {
          return '  PID TTY      ARGS\n 9999 ttys005  npx codex --quiet\n';
        }
        if (typeof cmd === 'string' && cmd.startsWith('lsof ')) {
          return 'p9999\nn/home/user/repo\n';
        }
        return '';
      });

      const { scanForCodexProcesses } = await import('../src/utils/process-scanner.js');
      const result = scanForCodexProcesses();

      expect(result).toHaveLength(1);
      expect(result[0].pid).toBe(9999);
      expect(result[0].source).toBe('codex');
    });

    it('should skip processes on unknown TTY', async () => {
      mockedExecSync.mockImplementation((cmd) => {
        if (typeof cmd === 'string' && cmd.startsWith('ps ')) {
          return '  PID TTY      ARGS\n 1111 ??       codex\n';
        }
        return '';
      });

      const { scanForCodexProcesses } = await import('../src/utils/process-scanner.js');
      const result = scanForCodexProcesses();
      expect(result).toEqual([]);
    });

    it('should skip claude-code-monitor processes', async () => {
      mockedExecSync.mockImplementation((cmd) => {
        if (typeof cmd === 'string' && cmd.startsWith('ps ')) {
          return '  PID TTY      ARGS\n 2222 ttys001  node claude-code-monitor codex\n';
        }
        return '';
      });

      const { scanForCodexProcesses } = await import('../src/utils/process-scanner.js');
      const result = scanForCodexProcesses();
      expect(result).toEqual([]);
    });

    it('should skip when lsof fails to get cwd', async () => {
      mockedExecSync.mockImplementation((cmd) => {
        if (typeof cmd === 'string' && cmd.startsWith('ps ')) {
          return '  PID TTY      ARGS\n 3333 ttys001  codex\n';
        }
        if (typeof cmd === 'string' && cmd.startsWith('lsof ')) {
          throw new Error('lsof failed');
        }
        return '';
      });

      const { scanForCodexProcesses } = await import('../src/utils/process-scanner.js');
      const result = scanForCodexProcesses();
      expect(result).toEqual([]);
    });
  });

  describe('syncProcessSessions', () => {
    it('should create a new codex session from detected process', async () => {
      const { syncProcessSessions, getSessions, flushPendingWrites } = await import(
        '../src/store/file-store.js'
      );

      syncProcessSessions([
        { pid: 1234, tty: '/dev/ttys001', cwd: '/home/user/project', source: 'codex' },
      ]);
      flushPendingWrites();

      const sessions = getSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].session_id).toBe('codex-1234');
      expect(sessions[0].status).toBe('running');
      expect(sessions[0].source).toBe('codex');
      expect(sessions[0].cwd).toBe('/home/user/project');
      expect(sessions[0].tty).toBe('/dev/ttys001');
    });

    it('should mark codex session as stopped when process disappears', async () => {
      const { syncProcessSessions, getSessions, flushPendingWrites } = await import(
        '../src/store/file-store.js'
      );

      syncProcessSessions([
        { pid: 1234, tty: '/dev/ttys001', cwd: '/home/user/project', source: 'codex' },
      ]);
      flushPendingWrites();

      syncProcessSessions([]);
      flushPendingWrites();

      const sessions = getSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].session_id).toBe('codex-1234');
      expect(sessions[0].status).toBe('stopped');
    });

    it('should not affect claude-code sessions', async () => {
      const { updateSession, syncProcessSessions, getSessions, flushPendingWrites } = await import(
        '../src/store/file-store.js'
      );

      updateSession({
        session_id: 'claude-abc',
        cwd: '/tmp',
        tty: '/dev/ttys002',
        hook_event_name: 'PreToolUse',
      });
      flushPendingWrites();

      syncProcessSessions([]);
      flushPendingWrites();

      const sessions = getSessions();
      const claudeSession = sessions.find((s) => s.session_id === 'claude-abc');
      expect(claudeSession).toBeDefined();
      expect(claudeSession?.status).toBe('running');
    });

    it('should preserve created_at when updating existing codex session', async () => {
      const { syncProcessSessions, getSession, flushPendingWrites } = await import(
        '../src/store/file-store.js'
      );

      syncProcessSessions([
        { pid: 5555, tty: '/dev/ttys003', cwd: '/tmp/a', source: 'codex' },
      ]);
      flushPendingWrites();

      const first = getSession('codex-5555', '/dev/ttys003');
      const createdAt = first?.created_at;

      await new Promise((r) => setTimeout(r, 10));

      syncProcessSessions([
        { pid: 5555, tty: '/dev/ttys003', cwd: '/tmp/a', source: 'codex' },
      ]);
      flushPendingWrites();

      const second = getSession('codex-5555', '/dev/ttys003');
      expect(second?.created_at).toBe(createdAt);
    });

    it('should remove old sessions on same TTY', async () => {
      const { syncProcessSessions, getSessions, flushPendingWrites } = await import(
        '../src/store/file-store.js'
      );

      syncProcessSessions([
        { pid: 100, tty: '/dev/ttys001', cwd: '/tmp', source: 'codex' },
      ]);
      flushPendingWrites();

      syncProcessSessions([
        { pid: 200, tty: '/dev/ttys001', cwd: '/tmp', source: 'codex' },
      ]);
      flushPendingWrites();

      const sessions = getSessions();
      const onTty = sessions.filter((s) => s.tty === '/dev/ttys001');
      expect(onTty).toHaveLength(1);
      expect(onTty[0].session_id).toBe('codex-200');
    });
  });
});
