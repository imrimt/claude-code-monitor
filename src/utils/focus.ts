import { accessSync, constants, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { executeAppleScript } from './applescript.js';
import { executeWithTerminalFallback } from './terminal-strategy.js';

/**
 * Sanitize a string for safe use in AppleScript.
 * Escapes backslashes, double quotes, control characters, and AppleScript special chars.
 * @internal
 */
export function sanitizeForAppleScript(str: string): string {
  return str
    .replace(/\\/g, '\\\\') // Backslash (must be first)
    .replace(/"/g, '\\"') // Double quote
    .replace(/\n/g, '\\n') // Newline
    .replace(/\r/g, '\\r') // Carriage return
    .replace(/\t/g, '\\t') // Tab
    .replace(/\$/g, '\\$') // Dollar sign (variable reference in some contexts)
    .replace(/`/g, '\\`'); // Backtick
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

/**
 * Generate a title tag for a TTY path.
 * Used to identify terminal windows/tabs by their title.
 * @example generateTitleTag('/dev/ttys001') => '[CCM:ttys001]'
 * @example generateTitleTag('/dev/pts/0') => '[CCM:pts-0]'
 * @internal
 */
export function generateTitleTag(tty: string): string {
  const match = tty.match(/\/dev\/(ttys?\d+|pts\/\d+)$/);
  if (!match) return '';
  const ttyId = match[1].replace('/', '-');
  return `[CCM:${ttyId}]`;
}

/**
 * Generate an OSC (Operating System Command) escape sequence to set terminal title.
 * OSC 0 sets both icon name and window title.
 * @internal
 */
export function generateOscTitleSequence(title: string): string {
  return `\x1b]0;${title}\x07`;
}

/**
 * Set the terminal title by writing an OSC sequence to the TTY.
 * Returns true if successful, false if the TTY is not writable.
 * @internal
 */
export function setTtyTitle(tty: string, title: string): boolean {
  if (!isValidTtyPath(tty)) return false;
  try {
    accessSync(tty, constants.W_OK);
    writeFileSync(tty, generateOscTitleSequence(title));
    return true;
  } catch {
    return false;
  }
}

/**
 * Build a terminal title with cwd and CCM tag.
 * @example buildTitleWithTag('/dev/ttys001', '/Users/me/project') => 'project [CCM:ttys001]'
 * @internal
 */
export function buildTitleWithTag(tty: string, cwd: string): string {
  const tag = generateTitleTag(tty);
  if (!tag) return '';
  const cwdName = basename(cwd) || cwd;
  return `${cwdName} ${tag}`;
}

/**
 * Set Ghostty terminal title with cwd and CCM tag.
 * Called during hook processing to maintain title context.
 * @returns true if title was set successfully
 */
export function setGhosttyTitle(tty: string, cwd: string): boolean {
  const title = buildTitleWithTag(tty, cwd);
  if (!title) return false;
  return setTtyTitle(tty, title);
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

function buildGhosttyFocusByTitleScript(titleTag: string): string {
  const safeTag = sanitizeForAppleScript(titleTag);
  return `
tell application "System Events"
  if not (exists process "Ghostty") then
    return false
  end if
  tell process "Ghostty"
    -- Try to find and click the window menu item with the title tag
    try
      set windowMenu to menu "Window" of menu bar 1
      set menuItems to every menu item of windowMenu whose title contains "${safeTag}"
      if (count of menuItems) > 0 then
        click item 1 of menuItems
        tell application "Ghostty" to activate
        return true
      end if
    end try
  end tell
end tell
return false
`;
}

function focusITerm2(tty: string): boolean {
  return executeAppleScript(buildITerm2Script(tty));
}

function focusTerminalApp(tty: string): boolean {
  return executeAppleScript(buildTerminalAppScript(tty));
}

function focusGhostty(tty: string): boolean {
  const titleTag = generateTitleTag(tty);

  // タイトルを設定してすぐにWindowメニューから検索してフォーカス
  // Claude Codeがタイトルを上書きする前にフォーカスを完了させる
  setTtyTitle(tty, titleTag);

  const success = executeAppleScript(buildGhosttyFocusByTitleScript(titleTag));
  if (success) return true;

  // フォールバック: 従来のactivateのみ
  return executeAppleScript(buildGhosttyScript());
}

export function isMacOS(): boolean {
  return process.platform === 'darwin';
}

export function focusSession(tty: string): boolean {
  if (!isMacOS()) return false;
  if (!isValidTtyPath(tty)) return false;

  return executeWithTerminalFallback({
    iTerm2: () => focusITerm2(tty),
    terminalApp: () => focusTerminalApp(tty),
    ghostty: () => focusGhostty(tty),
  });
}

export function getSupportedTerminals(): string[] {
  return ['iTerm2', 'Terminal.app', 'Ghostty'];
}
