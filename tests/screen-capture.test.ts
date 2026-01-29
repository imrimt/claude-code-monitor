import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureTerminalScreen, isMacOS } from '../src/utils/screen-capture.js';

describe('screen-capture', () => {
  describe('isMacOS', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
      });
    });

    it('should return true on macOS', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
      });
      expect(isMacOS()).toBe(true);
    });

    it('should return false on non-macOS', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
      });
      expect(isMacOS()).toBe(false);
    });

    it('should return false on Windows', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
      });
      expect(isMacOS()).toBe(false);
    });
  });

  describe('captureTerminalScreen', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
      });
      vi.restoreAllMocks();
    });

    it('should return null on non-macOS platform', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
      });
      const result = await captureTerminalScreen('/dev/pts/0');
      expect(result).toBeNull();
    });

    it('should return null for invalid tty path', async () => {
      if (process.platform === 'darwin') {
        const result = await captureTerminalScreen('/invalid/path');
        expect(result).toBeNull();
      }
    });

    it('should return null for empty tty path', async () => {
      if (process.platform === 'darwin') {
        const result = await captureTerminalScreen('');
        expect(result).toBeNull();
      }
    });

    it('should return null for tty path with directory traversal', async () => {
      if (process.platform === 'darwin') {
        const result = await captureTerminalScreen('/dev/../dev/ttys001');
        expect(result).toBeNull();
      }
    });

    it('should return null for tty path with special characters', async () => {
      if (process.platform === 'darwin') {
        const result = await captureTerminalScreen('/dev/ttys001; rm -rf /');
        expect(result).toBeNull();
      }
    });

    it('should accept valid macOS tty format', async () => {
      // Skip on CI - AppleScript hangs without terminal apps
      if (process.platform === 'darwin' && !process.env.CI) {
        // Valid format but TTY may not exist or terminal may not be running
        const result = await captureTerminalScreen('/dev/ttys999');
        // May return null (tty doesn't exist) or Base64 string (Ghostty fallback captures first window)
        // The important thing is it doesn't throw
        expect(result === null || typeof result === 'string').toBe(true);
      }
    });

    it('should accept valid Linux tty format on macOS', async () => {
      // Skip on CI - AppleScript hangs without terminal apps
      if (process.platform === 'darwin' && !process.env.CI) {
        // Linux format is accepted by the validator
        const result = await captureTerminalScreen('/dev/pts/0');
        // May return null or Base64 string (Ghostty fallback captures first window)
        expect(result === null || typeof result === 'string').toBe(true);
      }
    });

    it('should return Base64 string or null for valid tty', async () => {
      if (process.platform === 'darwin') {
        // Use the current process's tty if available
        const tty = process.env.TTY;
        if (tty) {
          const result = await captureTerminalScreen(tty);
          // May be null if terminal is not found or screen recording permission is not granted
          if (result !== null) {
            expect(typeof result).toBe('string');
            // Base64 PNG should start with iVBOR (PNG header in base64)
            expect(result.startsWith('iVBOR')).toBe(true);
          }
        }
      }
    });
  });
});
