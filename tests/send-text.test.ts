import { afterEach, describe, expect, it } from 'vitest';
import {
  ALLOWED_KEYS,
  ARROW_KEY_CODES,
  ENTER_KEY_CODE,
  sendKeystrokeToTerminal,
  sendTextToTerminal,
  validateTextInput,
} from '../src/utils/send-text.js';

describe('send-text', () => {
  describe('validateTextInput', () => {
    it('should reject empty string', () => {
      const result = validateTextInput('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Text cannot be empty');
    });

    it('should reject whitespace-only string', () => {
      const result = validateTextInput('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Text cannot be empty');
    });

    it('should reject string with only newlines', () => {
      const result = validateTextInput('\n\n');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Text cannot be empty');
    });

    it('should accept valid text', () => {
      const result = validateTextInput('echo hello');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept text with leading/trailing spaces', () => {
      const result = validateTextInput('  npm run build  ');
      expect(result.valid).toBe(true);
    });

    it('should accept multiline text', () => {
      const result = validateTextInput('line1\nline2\nline3');
      expect(result.valid).toBe(true);
    });

    it('should reject text exceeding maximum length', () => {
      const longText = 'a'.repeat(10001);
      const result = validateTextInput(longText);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum length');
    });

    it('should accept text at exactly maximum length', () => {
      const maxText = 'a'.repeat(10000);
      const result = validateTextInput(maxText);
      expect(result.valid).toBe(true);
    });

    it('should accept text with special characters', () => {
      const result = validateTextInput('echo "hello world" | grep hello');
      expect(result.valid).toBe(true);
    });

    it('should accept text with unicode characters', () => {
      const result = validateTextInput('echo "こんにちは"');
      expect(result.valid).toBe(true);
    });
  });

  describe('sendTextToTerminal', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
      });
    });

    it('should return error for non-macOS platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
      });
      const result = sendTextToTerminal('/dev/pts/0', 'test');
      expect(result.success).toBe(false);
      expect(result.error).toBe('This feature is only available on macOS');
    });

    it('should return error for invalid tty path', () => {
      // Only test on macOS where this check is reached
      if (process.platform === 'darwin') {
        const result = sendTextToTerminal('/invalid/path', 'test');
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid TTY path');
      }
    });

    it('should return error for empty text', () => {
      if (process.platform === 'darwin') {
        const result = sendTextToTerminal('/dev/ttys001', '');
        expect(result.success).toBe(false);
        expect(result.error).toBe('Text cannot be empty');
      }
    });

    it('should return error for text exceeding max length', () => {
      if (process.platform === 'darwin') {
        const longText = 'a'.repeat(10001);
        const result = sendTextToTerminal('/dev/ttys001', longText);
        expect(result.success).toBe(false);
        expect(result.error).toContain('exceeds maximum length');
      }
    });
  });

  describe('ALLOWED_KEYS', () => {
    it('should include arrow keys (up, down, left, right)', () => {
      expect(ALLOWED_KEYS.has('up')).toBe(true);
      expect(ALLOWED_KEYS.has('down')).toBe(true);
      expect(ALLOWED_KEYS.has('left')).toBe(true);
      expect(ALLOWED_KEYS.has('right')).toBe(true);
    });

    it('should include enter key', () => {
      expect(ALLOWED_KEYS.has('enter')).toBe(true);
    });
  });

  describe('ARROW_KEY_CODES', () => {
    it('should define correct macOS key codes for arrow keys', () => {
      expect(ARROW_KEY_CODES.up).toBe(126);
      expect(ARROW_KEY_CODES.down).toBe(125);
      expect(ARROW_KEY_CODES.left).toBe(123);
      expect(ARROW_KEY_CODES.right).toBe(124);
    });
  });

  describe('ENTER_KEY_CODE', () => {
    it('should be 36 (macOS key code for Return/Enter key)', () => {
      expect(ENTER_KEY_CODE).toBe(36);
    });
  });

  describe('sendKeystrokeToTerminal', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
      });
    });

    it('should accept arrow keys as valid input (not reject for length or invalid key)', () => {
      // Skip on CI - AppleScript hangs without terminal apps
      if (process.platform === 'darwin' && !process.env.CI) {
        // These should not return "Invalid key" error or "Key must be a single character" error
        const upResult = sendKeystrokeToTerminal('/dev/ttys001', 'up');
        const downResult = sendKeystrokeToTerminal('/dev/ttys001', 'down');
        const leftResult = sendKeystrokeToTerminal('/dev/ttys001', 'left');
        const rightResult = sendKeystrokeToTerminal('/dev/ttys001', 'right');

        // Should not return invalid key error (may fail for other reasons like terminal not found)
        expect(upResult.error).not.toBe('Invalid key. Allowed: y, n, a, 1-9, escape');
        expect(downResult.error).not.toBe('Invalid key. Allowed: y, n, a, 1-9, escape');
        expect(leftResult.error).not.toBe('Invalid key. Allowed: y, n, a, 1-9, escape');
        expect(rightResult.error).not.toBe('Invalid key. Allowed: y, n, a, 1-9, escape');

        // Should not return single character error
        expect(upResult.error).not.toBe('Key must be a single character or "escape"');
        expect(downResult.error).not.toBe('Key must be a single character or "escape"');
        expect(leftResult.error).not.toBe('Key must be a single character or "escape"');
        expect(rightResult.error).not.toBe('Key must be a single character or "escape"');
      }
    });

    it('should accept enter key as valid input (not reject for length or invalid key)', () => {
      // Skip on CI - AppleScript hangs without terminal apps
      if (process.platform === 'darwin' && !process.env.CI) {
        const result = sendKeystrokeToTerminal('/dev/ttys001', 'enter');
        expect(result.error).not.toBe('Invalid key. Allowed: y, n, a, 1-9, escape');
        expect(result.error).not.toBe('Key must be a single character or "escape"');
      }
    });

    it('should return error for non-macOS platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
      });
      const result = sendKeystrokeToTerminal('/dev/pts/0', 'y');
      expect(result.success).toBe(false);
      expect(result.error).toBe('This feature is only available on macOS');
    });

    it('should return error for invalid tty path', () => {
      if (process.platform === 'darwin') {
        const result = sendKeystrokeToTerminal('/invalid/path', 'y');
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid TTY path');
      }
    });
  });
});
