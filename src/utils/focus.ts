import { accessSync, constants, writeFileSync } from 'node:fs';
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
 * @example generateTitleTag('/dev/ttys001') => 'ccm:ttys001'
 * @example generateTitleTag('/dev/pts/0') => 'ccm:pts-0'
 * @internal
 */
export function generateTitleTag(tty: string): string {
  const match = tty.match(/\/dev\/(ttys?\d+|pts\/\d+)$/);
  if (!match) return '';
  const ttyId = match[1].replace('/', '-');
  return `ccm:${ttyId}`;
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
    -- First, try to find in Window menu (works if tab is currently active)
    try
      set windowMenu to menu "Window" of menu bar 1
      set menuItems to every menu item of windowMenu whose title contains "${safeTag}"
      if (count of menuItems) > 0 then
        click item 1 of menuItems
        delay 0.1
        tell application "Ghostty" to activate
        return true
      end if
    end try

    -- If not found in menu, the tab might be inactive.
    -- We need to search through all windows and tabs using "Show Next Tab" menu.
    -- First, remember the current frontmost window to restore if not found.
    set originalWindow to missing value
    try
      set originalWindow to front window
    end try

    set windowMenu to menu "Window" of menu bar 1
    set windowCount to count of windows

    repeat with winIdx from 1 to windowCount
      try
        -- Focus this window
        set targetWindow to window winIdx
        perform action "AXRaise" of targetWindow
        tell application "Ghostty" to activate
        delay 0.05

        -- Check if current active tab already has the title
        set winName to name of window 1
        if winName contains "${safeTag}" then
          return true
        end if

        -- Remember the first tab's title to detect when we've cycled through all tabs
        set firstTabTitle to winName

        -- Iterate through tabs using "Show Next Tab" menu item
        -- Max 50 iterations to prevent infinite loop
        repeat 50 times
          try
            -- Click "Show Next Tab" menu item
            click menu item "Show Next Tab" of windowMenu
            delay 0.1

            -- Check the window title after tab switch
            set winName to name of window 1

            -- Found the target tab
            if winName contains "${safeTag}" then
              return true
            end if

            -- If we're back to the first tab, we've cycled through all tabs
            if winName is equal to firstTabTitle then
              exit repeat
            end if
          on error
            -- "Show Next Tab" might be disabled (single tab window)
            exit repeat
          end try
        end repeat
      end try
    end repeat

    -- Not found - restore original window if possible
    if originalWindow is not missing value then
      try
        perform action "AXRaise" of originalWindow
        tell application "Ghostty" to activate
      end try
    end if
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

  // Set title tag for window identification
  // This updates the terminal title so we can find it by searching
  const titleSet = setTtyTitle(tty, titleTag);

  if (titleSet) {
    // Wait for title to propagate (terminal needs time to update)
    const waitScript = 'delay 0.15';
    executeAppleScript(waitScript);
  }

  // Try to focus by searching through windows and tabs
  const success = executeAppleScript(buildGhosttyFocusByTitleScript(titleTag));

  // Clear title to let shell-integration restore it
  if (titleSet) {
    setTtyTitle(tty, '');
  }

  if (success) return true;

  // Fallback: activate Ghostty without specific window focus
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
