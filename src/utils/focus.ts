import { executeAppleScript } from './applescript.js';

/**
 * Sanitize a string for safe use in AppleScript.
 * Escapes backslashes, double quotes, and control characters to prevent injection.
 * @internal
 */
export function sanitizeForAppleScript(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * TTY path pattern for validation.
 * Matches:
 *   - macOS: /dev/ttys000, /dev/tty000
 *   - Linux: /dev/pts/0
 * @internal
 */
const TTY_PATH_PATTERN = /^\/dev\/(ttys?\d+|pts\/\d+)$/;

/**
 * Validate TTY path format.
 * @internal
 */
export function isValidTtyPath(tty: string): boolean {
  return TTY_PATH_PATTERN.test(tty);
}

function buildITerm2Script(tty: string): string {
  const safeTty = sanitizeForAppleScript(tty);
  return `
tell application "iTerm2"
  repeat with aWindow in windows
    repeat with aTab in tabs of aWindow
      repeat with aSession in sessions of aTab
        if tty of aSession is "${safeTty}" then
          select aSession
          select aTab
          tell aWindow to select
          activate
          return true
        end if
      end repeat
    end repeat
  end repeat
  return false
end tell
`;
}

function buildTerminalAppScript(tty: string): string {
  const safeTty = sanitizeForAppleScript(tty);
  return `
tell application "Terminal"
  repeat with aWindow in windows
    repeat with aTab in tabs of aWindow
      if tty of aTab is "${safeTty}" then
        set selected of aTab to true
        set index of aWindow to 1
        activate
        return true
      end if
    end repeat
  end repeat
  return false
end tell
`;
}

function buildGhosttyScript(): string {
  return `
tell application "Ghostty"
  activate
end tell
return true
`;
}

function focusITerm2(tty: string): boolean {
  return executeAppleScript(buildITerm2Script(tty));
}

function focusTerminalApp(tty: string): boolean {
  return executeAppleScript(buildTerminalAppScript(tty));
}

function focusGhostty(): boolean {
  return executeAppleScript(buildGhosttyScript());
}

export function isMacOS(): boolean {
  return process.platform === 'darwin';
}

export function focusSession(tty: string): boolean {
  if (!isMacOS()) return false;
  if (!isValidTtyPath(tty)) return false;

  // Try each terminal in order (use the first one that succeeds)
  const focusStrategies = [
    () => focusITerm2(tty),
    () => focusTerminalApp(tty),
    () => focusGhostty(),
  ];

  return focusStrategies.some((tryFocus) => tryFocus());
}

export function getSupportedTerminals(): string[] {
  return ['iTerm2', 'Terminal.app', 'Ghostty'];
}
