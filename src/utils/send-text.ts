import { execFileSync } from 'node:child_process';
import { isMacOS, isValidTtyPath, sanitizeForAppleScript } from './focus.js';

/**
 * Maximum text length allowed for sending to terminal.
 * This is a security measure to prevent accidental or malicious large inputs.
 */
const MAX_TEXT_LENGTH = 10000;

/**
 * Validate text input for sending to terminal.
 * @internal
 */
export function validateTextInput(text: string): { valid: boolean; error?: string } {
  if (!text || text.trim().length === 0) {
    return { valid: false, error: 'Text cannot be empty' };
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return { valid: false, error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters` };
  }

  return { valid: true };
}

function executeAppleScript(script: string): boolean {
  try {
    const result = execFileSync('osascript', ['-e', script], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return result === 'true';
  } catch {
    return false;
  }
}

/**
 * Build AppleScript to send text to iTerm2 session by TTY.
 * Uses clipboard and Cmd+V to paste text, then sends Enter key.
 * This approach supports Unicode characters including Japanese.
 */
function buildITerm2SendTextScript(tty: string, text: string): string {
  const safeTty = sanitizeForAppleScript(tty);
  const safeText = sanitizeForAppleScript(text);
  return `
set the clipboard to "${safeText}"
tell application "iTerm2"
  repeat with aWindow in windows
    repeat with aTab in tabs of aWindow
      repeat with aSession in sessions of aTab
        if tty of aSession is "${safeTty}" then
          select aSession
          select aTab
          tell aWindow to select
          activate
          delay 0.1
          tell application "System Events"
            tell process "iTerm2"
              keystroke "v" using command down
              delay 0.05
              keystroke return
            end tell
          end tell
          return true
        end if
      end repeat
    end repeat
  end repeat
  return false
end tell
`;
}

/**
 * Build AppleScript to send text to Terminal.app by TTY.
 * Uses clipboard and Cmd+V to paste text, then sends Enter key.
 * This approach supports Unicode characters including Japanese.
 */
function buildTerminalAppSendTextScript(tty: string, text: string): string {
  const safeTty = sanitizeForAppleScript(tty);
  const safeText = sanitizeForAppleScript(text);
  return `
set the clipboard to "${safeText}"
tell application "Terminal"
  repeat with aWindow in windows
    repeat with aTab in tabs of aWindow
      if tty of aTab is "${safeTty}" then
        set selected of aTab to true
        set index of aWindow to 1
        activate
        delay 0.1
        tell application "System Events"
          tell process "Terminal"
            keystroke "v" using command down
            delay 0.05
            keystroke return
          end tell
        end tell
        return true
      end if
    end repeat
  end repeat
  return false
end tell
`;
}

/**
 * Build AppleScript to send text to Ghostty via System Events.
 * Ghostty doesn't support TTY-based targeting, so we send to the active window.
 * Uses clipboard and Cmd+V to paste text, then sends Enter key.
 * This approach supports Unicode characters including Japanese.
 */
function buildGhosttySendTextScript(text: string): string {
  const safeText = sanitizeForAppleScript(text);
  // Use key code 36 (Return/Enter key) instead of keystroke return
  // as Ghostty may handle keyboard events differently
  return `
set the clipboard to "${safeText}"
tell application "Ghostty"
  activate
end tell
delay 0.3
tell application "System Events"
  tell process "Ghostty"
    keystroke "v" using command down
    delay 0.1
    key code 36
  end tell
end tell
return true
`;
}

function sendTextToITerm2(tty: string, text: string): boolean {
  return executeAppleScript(buildITerm2SendTextScript(tty, text));
}

function sendTextToTerminalApp(tty: string, text: string): boolean {
  return executeAppleScript(buildTerminalAppSendTextScript(tty, text));
}

function sendTextToGhostty(text: string): boolean {
  return executeAppleScript(buildGhosttySendTextScript(text));
}

/**
 * Send text to a terminal session and execute it (press Enter).
 * Tries iTerm2, Terminal.app, and Ghostty in order.
 *
 * @param tty - The TTY path of the target terminal session
 * @param text - The text to send to the terminal
 * @returns true if text was sent successfully, false otherwise
 *
 * @remarks
 * - This is macOS only (uses AppleScript)
 * - For iTerm2 and Terminal.app, targets specific TTY
 * - For Ghostty, sends to the active window (TTY targeting not supported)
 * - System Events usage for Ghostty may require accessibility permissions
 */
export function sendTextToTerminal(
  tty: string,
  text: string
): { success: boolean; error?: string } {
  if (!isMacOS()) {
    return { success: false, error: 'This feature is only available on macOS' };
  }

  if (!isValidTtyPath(tty)) {
    return { success: false, error: 'Invalid TTY path' };
  }

  const validation = validateTextInput(text);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Try each terminal in order (use the first one that succeeds)
  const sendStrategies = [
    () => sendTextToITerm2(tty, text),
    () => sendTextToTerminalApp(tty, text),
    () => sendTextToGhostty(text),
  ];

  const success = sendStrategies.some((trySend) => trySend());

  if (success) {
    return { success: true };
  }

  return { success: false, error: 'Could not send text to any terminal' };
}
