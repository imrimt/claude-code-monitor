import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  captureTerminalScreen,
  captureWindow,
  getTerminalWindowId,
} from '../src/utils/screen-capture.js';

describe('screen-capture', () => {
  describe('getTerminalWindowId', () => {
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
      const result = await getTerminalWindowId('iTerm2');
      expect(result).toBeNull();
    });

    it('should return null for empty app name', async () => {
      if (process.platform === 'darwin') {
        const result = await getTerminalWindowId('');
        expect(result).toBeNull();
      }
    });

    it('should return null for non-existent app', async () => {
      if (process.platform === 'darwin') {
        const result = await getTerminalWindowId('NonExistentApp12345');
        expect(result).toBeNull();
      }
    });

    it('should return a number or null for valid terminal app names', async () => {
      if (process.platform === 'darwin') {
        // Test with valid terminal app names - may return null if app is not running
        const result = await getTerminalWindowId('iTerm2');
        expect(result === null || typeof result === 'number').toBe(true);
        if (result !== null) {
          expect(result).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('captureWindow', () => {
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
      const result = await captureWindow(12345);
      expect(result).toBeNull();
    });

    it('should return null for invalid windowId (0)', async () => {
      if (process.platform === 'darwin') {
        const result = await captureWindow(0);
        expect(result).toBeNull();
      }
    });

    it('should return null for negative windowId', async () => {
      if (process.platform === 'darwin') {
        const result = await captureWindow(-1);
        expect(result).toBeNull();
      }
    });

    it('should return null for non-existent windowId', async () => {
      if (process.platform === 'darwin') {
        // Using a very high window ID that is unlikely to exist
        const result = await captureWindow(999999999);
        expect(result).toBeNull();
      }
    });

    it('should return Base64 string for valid windowId', async () => {
      if (process.platform === 'darwin') {
        // First, get a valid window ID from a running app
        const windowId = await getTerminalWindowId('Finder');
        if (windowId !== null) {
          const result = await captureWindow(windowId);
          // May be null if screen recording permission is not granted
          if (result !== null) {
            expect(typeof result).toBe('string');
            // Base64 PNG should start with iVBOR (PNG header in base64)
            expect(result.startsWith('iVBOR')).toBe(true);
          }
        }
      }
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
