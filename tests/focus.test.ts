import { afterEach, describe, expect, it } from 'vitest';
import {
  buildTitleWithTag,
  focusSession,
  generateOscTitleSequence,
  generateTitleTag,
  getSupportedTerminals,
  isMacOS,
  isValidTtyPath,
  sanitizeForAppleScript,
  setGhosttyTitle,
  setTtyTitle,
} from '../src/utils/focus.js';

describe('focus', () => {
  describe('sanitizeForAppleScript', () => {
    it('should escape backslashes', () => {
      expect(sanitizeForAppleScript('path\\to\\file')).toBe('path\\\\to\\\\file');
    });

    it('should escape double quotes', () => {
      expect(sanitizeForAppleScript('say "hello"')).toBe('say \\"hello\\"');
    });

    it('should escape newlines', () => {
      expect(sanitizeForAppleScript('line1\nline2')).toBe('line1\\nline2');
    });

    it('should escape carriage returns', () => {
      expect(sanitizeForAppleScript('line1\rline2')).toBe('line1\\rline2');
    });

    it('should escape tabs', () => {
      expect(sanitizeForAppleScript('col1\tcol2')).toBe('col1\\tcol2');
    });

    it('should handle multiple escape sequences', () => {
      expect(sanitizeForAppleScript('path\\with"quotes\nand\ttabs')).toBe(
        'path\\\\with\\"quotes\\nand\\ttabs'
      );
    });

    it('should return empty string unchanged', () => {
      expect(sanitizeForAppleScript('')).toBe('');
    });

    it('should return safe string unchanged', () => {
      expect(sanitizeForAppleScript('/dev/ttys001')).toBe('/dev/ttys001');
    });
  });

  describe('isValidTtyPath', () => {
    it('should accept valid macOS tty paths', () => {
      expect(isValidTtyPath('/dev/ttys000')).toBe(true);
      expect(isValidTtyPath('/dev/ttys001')).toBe(true);
      expect(isValidTtyPath('/dev/ttys123')).toBe(true);
      expect(isValidTtyPath('/dev/tty0')).toBe(true);
      expect(isValidTtyPath('/dev/tty99')).toBe(true);
    });

    it('should accept valid Linux pts paths', () => {
      expect(isValidTtyPath('/dev/pts/0')).toBe(true);
      expect(isValidTtyPath('/dev/pts/1')).toBe(true);
      expect(isValidTtyPath('/dev/pts/99')).toBe(true);
    });

    it('should reject invalid paths', () => {
      expect(isValidTtyPath('')).toBe(false);
      expect(isValidTtyPath('/dev/null')).toBe(false);
      expect(isValidTtyPath('/dev/tty')).toBe(false);
      expect(isValidTtyPath('/tmp/tty')).toBe(false);
      expect(isValidTtyPath('/dev/ttys')).toBe(false);
      expect(isValidTtyPath('/dev/pts/')).toBe(false);
      expect(isValidTtyPath('ttys001')).toBe(false);
    });

    it('should reject paths with injection attempts', () => {
      expect(isValidTtyPath('/dev/ttys001"; rm -rf /')).toBe(false);
      expect(isValidTtyPath('/dev/ttys001\n/dev/ttys002')).toBe(false);
      expect(isValidTtyPath('/dev/pts/0; echo pwned')).toBe(false);
    });
  });

  describe('generateTitleTag', () => {
    it('should generate tag from macOS tty path', () => {
      expect(generateTitleTag('/dev/ttys001')).toBe('[CCM:ttys001]');
      expect(generateTitleTag('/dev/ttys123')).toBe('[CCM:ttys123]');
    });

    it('should generate tag from macOS tty path without s', () => {
      expect(generateTitleTag('/dev/tty0')).toBe('[CCM:tty0]');
      expect(generateTitleTag('/dev/tty99')).toBe('[CCM:tty99]');
    });

    it('should generate tag from Linux pts path', () => {
      expect(generateTitleTag('/dev/pts/0')).toBe('[CCM:pts-0]');
      expect(generateTitleTag('/dev/pts/99')).toBe('[CCM:pts-99]');
    });

    it('should return empty string for invalid path', () => {
      expect(generateTitleTag('/invalid/path')).toBe('');
      expect(generateTitleTag('')).toBe('');
      expect(generateTitleTag('/dev/null')).toBe('');
      expect(generateTitleTag('/dev/tty')).toBe('');
    });
  });

  describe('generateOscTitleSequence', () => {
    it('should generate valid OSC sequence', () => {
      expect(generateOscTitleSequence('Test')).toBe('\x1b]0;Test\x07');
    });

    it('should handle title with CCM tag', () => {
      expect(generateOscTitleSequence('[CCM:ttys001]')).toBe('\x1b]0;[CCM:ttys001]\x07');
    });

    it('should handle empty title', () => {
      expect(generateOscTitleSequence('')).toBe('\x1b]0;\x07');
    });
  });

  describe('setTtyTitle', () => {
    it('should return false for invalid tty path', () => {
      expect(setTtyTitle('/invalid/path', 'Test')).toBe(false);
      expect(setTtyTitle('', 'Test')).toBe(false);
    });

    it('should return false for non-existent tty', () => {
      // This TTY is unlikely to exist
      expect(setTtyTitle('/dev/ttys999', 'Test')).toBe(false);
    });
  });

  describe('buildTitleWithTag', () => {
    it('should build title with cwd basename and tag', () => {
      expect(buildTitleWithTag('/dev/ttys001', '/Users/me/project')).toBe('project [CCM:ttys001]');
    });

    it('should handle cwd with trailing slash', () => {
      expect(buildTitleWithTag('/dev/ttys001', '/Users/me/project/')).toBe('project [CCM:ttys001]');
    });

    it('should handle root path', () => {
      expect(buildTitleWithTag('/dev/ttys001', '/')).toBe('/ [CCM:ttys001]');
    });

    it('should return empty string for invalid tty', () => {
      expect(buildTitleWithTag('/invalid', '/Users/me/project')).toBe('');
    });
  });

  describe('setGhosttyTitle', () => {
    it('should return false for invalid tty path', () => {
      expect(setGhosttyTitle('/invalid/path', '/Users/me/project')).toBe(false);
    });

    it('should return false for non-existent tty', () => {
      expect(setGhosttyTitle('/dev/ttys999', '/Users/me/project')).toBe(false);
    });
  });

  describe('isMacOS', () => {
    it('should return boolean based on platform', () => {
      const result = isMacOS();
      expect(typeof result).toBe('boolean');
      // On macOS, should return true
      if (process.platform === 'darwin') {
        expect(result).toBe(true);
      } else {
        expect(result).toBe(false);
      }
    });
  });

  describe('getSupportedTerminals', () => {
    it('should return array of supported terminal names', () => {
      const terminals = getSupportedTerminals();
      expect(Array.isArray(terminals)).toBe(true);
      expect(terminals).toContain('iTerm2');
      expect(terminals).toContain('Terminal.app');
      expect(terminals).toContain('Ghostty');
    });

    it('should return exactly 3 terminals', () => {
      const terminals = getSupportedTerminals();
      expect(terminals).toHaveLength(3);
    });
  });

  describe('focusSession', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
      });
    });

    it('should return false for invalid tty path', () => {
      // Only test on macOS where this check is reached
      if (process.platform === 'darwin') {
        expect(focusSession('/invalid/path')).toBe(false);
        expect(focusSession('')).toBe(false);
      }
    });

    it('should return false on non-macOS platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
      });
      expect(focusSession('/dev/pts/0')).toBe(false);
    });
  });
});
