import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/utils/applescript.js', () => ({
  executeAppleScriptWithResult: vi.fn(),
}));

import type { Session } from '../src/types/index.js';
import { executeAppleScriptWithResult } from '../src/utils/applescript.js';
import {
  buildGhosttyTabNameScript,
  buildITerm2TabNameScript,
  buildTerminalAppTabNameScript,
  clearTabNameCache,
  enrichSessionsWithTabNames,
  getTabName,
} from '../src/utils/tab-name.js';

const mockExecute = vi.mocked(executeAppleScriptWithResult);

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    session_id: 'test-123',
    cwd: '/Users/test/project',
    tty: '/dev/ttys001',
    status: 'running',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('tab-name', () => {
  beforeEach(() => {
    clearTabNameCache();
    mockExecute.mockReset();
  });

  afterEach(() => {
    clearTabNameCache();
  });

  describe('AppleScript builders', () => {
    it('buildITerm2TabNameScript produces script with TTY', () => {
      const script = buildITerm2TabNameScript('/dev/ttys001');
      expect(script).toContain('iTerm2');
      expect(script).toContain('/dev/ttys001');
      expect(script).toContain('name of aSession');
    });

    it('buildTerminalAppTabNameScript produces script with TTY', () => {
      const script = buildTerminalAppTabNameScript('/dev/ttys001');
      expect(script).toContain('Terminal');
      expect(script).toContain('/dev/ttys001');
      expect(script).toContain('custom title of aTab');
    });

    it('buildGhosttyTabNameScript returns null', () => {
      expect(buildGhosttyTabNameScript()).toBeNull();
    });

    it('buildITerm2TabNameScript escapes special characters in TTY', () => {
      const script = buildITerm2TabNameScript('/dev/ttys"001');
      expect(script).toContain('\\"');
    });
  });

  describe('getTabName', () => {
    it('returns name from iTerm2 when available', () => {
      mockExecute.mockReturnValueOnce('My Tab');
      const result = getTabName('/dev/ttys001');
      expect(result).toBe('My Tab');
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('falls back to Terminal.app when iTerm2 returns null', () => {
      mockExecute.mockReturnValueOnce(null);
      mockExecute.mockReturnValueOnce('Terminal Tab');
      const result = getTabName('/dev/ttys001');
      expect(result).toBe('Terminal Tab');
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });

    it('returns null when no terminal returns a name', () => {
      mockExecute.mockReturnValue(null);
      const result = getTabName('/dev/ttys001');
      expect(result).toBeNull();
    });

    it('returns cached value without re-executing AppleScript', () => {
      mockExecute.mockReturnValueOnce('Cached Tab');
      getTabName('/dev/ttys001');
      mockExecute.mockClear();

      const result = getTabName('/dev/ttys001');
      expect(result).toBe('Cached Tab');
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('re-fetches after cache TTL expires', () => {
      mockExecute.mockReturnValueOnce('Old Tab');
      getTabName('/dev/ttys001');

      // Advance time past TTL
      vi.useFakeTimers();
      vi.advanceTimersByTime(31_000);

      mockExecute.mockReturnValueOnce('New Tab');
      const result = getTabName('/dev/ttys001');
      expect(result).toBe('New Tab');

      vi.useRealTimers();
    });

    it('caches null results too', () => {
      mockExecute.mockReturnValue(null);
      getTabName('/dev/ttys001');
      mockExecute.mockClear();

      const result = getTabName('/dev/ttys001');
      expect(result).toBeNull();
      expect(mockExecute).not.toHaveBeenCalled();
    });
  });

  describe('enrichSessionsWithTabNames', () => {
    it('attaches tabName when available', () => {
      mockExecute.mockReturnValueOnce('My Tab');
      const sessions = [makeSession()];
      const result = enrichSessionsWithTabNames(sessions);
      expect(result[0].tabName).toBe('My Tab');
    });

    it('passes through sessions without TTY unchanged', () => {
      const sessions = [makeSession({ tty: undefined })];
      const result = enrichSessionsWithTabNames(sessions);
      expect(result[0].tabName).toBeUndefined();
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('leaves tabName undefined when AppleScript returns null', () => {
      mockExecute.mockReturnValue(null);
      const sessions = [makeSession()];
      const result = enrichSessionsWithTabNames(sessions);
      expect(result[0].tabName).toBeUndefined();
    });

    it('does not mutate original session objects', () => {
      mockExecute.mockReturnValueOnce('Tab Name');
      const original = makeSession();
      const sessions = [original];
      const result = enrichSessionsWithTabNames(sessions);
      expect(original.tabName).toBeUndefined();
      expect(result[0].tabName).toBe('Tab Name');
    });

    it('handles empty session list', () => {
      const result = enrichSessionsWithTabNames([]);
      expect(result).toEqual([]);
    });

    it('handles mixed sessions with and without TTY', () => {
      mockExecute.mockReturnValueOnce('Named Tab');
      const sessions = [
        makeSession({ session_id: 's1', tty: '/dev/ttys001' }),
        makeSession({ session_id: 's2', tty: undefined }),
      ];
      const result = enrichSessionsWithTabNames(sessions);
      expect(result[0].tabName).toBe('Named Tab');
      expect(result[1].tabName).toBeUndefined();
    });
  });
});
