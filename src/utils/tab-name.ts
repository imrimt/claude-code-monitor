import { TTY_CACHE_TTL_MS } from '../constants.js';
import type { Session } from '../types/index.js';
import { executeAppleScriptWithResult } from './applescript.js';
import { sanitizeForAppleScript } from './focus.js';

interface CacheEntry {
  name: string | null;
  fetchedAt: number;
}

const tabNameCache = new Map<string, CacheEntry>();

/** @internal - exported for testing */
export function clearTabNameCache(): void {
  tabNameCache.clear();
}

/** @internal */
export function buildITerm2TabNameScript(tty: string): string {
  const safeTty = sanitizeForAppleScript(tty);
  return `
tell application "System Events"
  if not (exists process "iTerm2") then return ""
end tell

tell application "iTerm2"
  repeat with aWindow in windows
    repeat with aTab in tabs of aWindow
      repeat with aSession in sessions of aTab
        if tty of aSession is "${safeTty}" then
          return name of aSession
        end if
      end repeat
    end repeat
  end repeat
end tell
return ""
`;
}

/** @internal */
export function buildTerminalAppTabNameScript(tty: string): string {
  const safeTty = sanitizeForAppleScript(tty);
  return `
tell application "System Events"
  if not (exists process "Terminal") then return ""
end tell

tell application "Terminal"
  repeat with aWindow in windows
    repeat with aTab in tabs of aWindow
      if tty of aTab is "${safeTty}" then
        set tabTitle to custom title of aTab
        if tabTitle is not "" then return tabTitle
        return name of aTab
      end if
    end repeat
  end repeat
end tell
return ""
`;
}

/** Ghostty lacks per-tab AppleScript API */
export function buildGhosttyTabNameScript(): null {
  return null;
}

export function getTabName(tty: string): string | null {
  const now = Date.now();
  const cached = tabNameCache.get(tty);
  if (cached && now - cached.fetchedAt < TTY_CACHE_TTL_MS) {
    return cached.name;
  }

  let name: string | null = null;

  // Try iTerm2
  const iterm2Result = executeAppleScriptWithResult(buildITerm2TabNameScript(tty));
  if (iterm2Result) {
    name = iterm2Result;
  } else {
    // Try Terminal.app
    const terminalResult = executeAppleScriptWithResult(buildTerminalAppTabNameScript(tty));
    if (terminalResult) {
      name = terminalResult;
    }
    // Ghostty: no per-tab API, skip
  }

  tabNameCache.set(tty, { name, fetchedAt: now });
  return name;
}

export function enrichSessionsWithTabNames(sessions: Session[]): Session[] {
  return sessions.map((session) => {
    if (!session.tty) return session;
    const tabName = getTabName(session.tty);
    if (!tabName) return session;
    return { ...session, tabName };
  });
}
