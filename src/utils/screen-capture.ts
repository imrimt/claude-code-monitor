import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Check if running on macOS.
 */
export function isMacOS(): boolean {
  return process.platform === 'darwin';
}

/**
 * Swift inline script to get window ID using CGWindowListCopyWindowInfo.
 * This finds the first window belonging to the specified application.
 */
function buildSwiftWindowIdScript(appName: string): string {
  // Escape single quotes in app name for Swift string
  const safeAppName = appName.replace(/'/g, "\\'");
  return `
import Cocoa
import CoreGraphics

let appName = "${safeAppName}"

// Get all windows
guard let windowList = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else {
    print("-1")
    exit(0)
}

// Find window for the specified app
for window in windowList {
    if let ownerName = window[kCGWindowOwnerName as String] as? String,
       ownerName == appName,
       let windowId = window[kCGWindowNumber as String] as? Int {
        print(windowId)
        exit(0)
    }
}

// Not found
print("-1")
`;
}

/**
 * Get the window ID of a terminal application.
 * Uses Swift with CGWindowListCopyWindowInfo to find the window.
 *
 * @param appName - Name of the terminal app (e.g., "iTerm2", "Terminal", "Ghostty")
 * @returns Window ID if found, null otherwise
 */
export async function getTerminalWindowId(appName: string): Promise<number | null> {
  if (!isMacOS()) {
    return null;
  }

  if (!appName || appName.trim() === '') {
    return null;
  }

  const script = buildSwiftWindowIdScript(appName);

  try {
    const { stdout } = await execFileAsync('swift', ['-e', script], {
      encoding: 'utf-8',
      timeout: 10000, // 10 second timeout
    });

    const windowId = parseInt(stdout.trim(), 10);
    if (Number.isNaN(windowId) || windowId < 0) {
      return null;
    }

    return windowId;
  } catch {
    return null;
  }
}

/**
 * Capture a window by its ID and return the image as a Base64-encoded PNG.
 * Uses macOS screencapture command with the -l flag to capture a specific window.
 *
 * @param windowId - The window ID to capture
 * @returns Base64-encoded PNG string if successful, null otherwise
 */
export async function captureWindow(windowId: number): Promise<string | null> {
  if (!isMacOS()) {
    return null;
  }

  if (windowId <= 0) {
    return null;
  }

  const tempPath = `/tmp/ccm-capture-${randomUUID()}.png`;

  try {
    // screencapture -l<windowId> -x -o <path>
    // -l: capture specific window by ID
    // -x: no sound
    // -o: no shadow
    await execFileAsync('screencapture', [`-l${windowId}`, '-x', '-o', tempPath], {
      encoding: 'utf-8',
      timeout: 10000, // 10 second timeout
    });

    // Read the captured image file
    const imageBuffer = await readFile(tempPath);

    // Clean up temp file
    await unlink(tempPath).catch(() => {
      // Ignore cleanup errors
    });

    // Convert to Base64
    return imageBuffer.toString('base64');
  } catch {
    // Clean up temp file on error
    await unlink(tempPath).catch(() => {
      // Ignore cleanup errors
    });
    return null;
  }
}

/**
 * TTY path pattern for validation.
 * Matches:
 *   - macOS: /dev/ttys000, /dev/tty000
 *   - Linux: /dev/pts/0
 */
const TTY_PATH_PATTERN = /^\/dev\/(ttys?\d+|pts\/\d+)$/;

/**
 * Validate TTY path format.
 */
function isValidTtyPath(tty: string): boolean {
  return TTY_PATH_PATTERN.test(tty);
}

/**
 * Supported terminal applications.
 * Order matters: tries each in sequence until one succeeds.
 */
const TERMINAL_APPS = ['iTerm2', 'Terminal', 'Ghostty'] as const;

/**
 * Capture the terminal window associated with a TTY.
 * Tries to find and capture the window from iTerm2, Terminal.app, or Ghostty.
 *
 * @param tty - The TTY path (e.g., "/dev/ttys001")
 * @returns Base64-encoded PNG string if successful, null otherwise
 */
export async function captureTerminalScreen(tty: string): Promise<string | null> {
  if (!isMacOS()) {
    return null;
  }

  if (!tty || !isValidTtyPath(tty)) {
    return null;
  }

  // Try each terminal application in order
  for (const appName of TERMINAL_APPS) {
    const windowId = await getTerminalWindowId(appName);
    if (windowId !== null) {
      const base64 = await captureWindow(windowId);
      if (base64 !== null) {
        return base64;
      }
    }
  }

  return null;
}
