import { execFileSync } from 'node:child_process';

/**
 * Execute an AppleScript and return whether it succeeded.
 * @param script - AppleScript code to execute
 * @returns true if the script returned "true", false otherwise
 */
export function executeAppleScript(script: string): boolean {
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
 * Execute an AppleScript and return the result as a string.
 * @param script - AppleScript code to execute
 * @returns trimmed result string, or null on failure/empty result
 */
export function executeAppleScriptWithResult(script: string): string | null {
  try {
    const result = execFileSync('osascript', ['-e', script], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    }).trim();
    return result || null;
  } catch {
    return null;
  }
}
