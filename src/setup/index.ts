import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { HOOK_EVENTS, PACKAGE_NAME } from '../constants.js';
import { askConfirmation } from '../utils/prompt.js';

const CLAUDE_DIR = join(homedir(), '.claude');
const SETTINGS_FILE = join(CLAUDE_DIR, 'settings.json');

/** Environment variable key to disable Claude Code terminal title override */
const DISABLE_TITLE_ENV_KEY = 'CLAUDE_CODE_DISABLE_TERMINAL_TITLE';

/** @internal */
export interface HookConfig {
  type: 'command';
  command: string;
}

/** @internal */
export interface HookEntry {
  matcher?: string;
  hooks: HookConfig[];
}

/** @internal */
export interface Settings {
  hooks?: Record<string, HookEntry[]>;
  env?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Check if a command string is a ccm hook command for the given event
 * @internal
 */
function isCcmHookCommand(command: string, eventName: string): boolean {
  return command === `ccm hook ${eventName}` || command === `npx ${PACKAGE_NAME} hook ${eventName}`;
}

/**
 * Check if the ccm hook is already configured for the given event
 * @internal
 */
export function hasCcmHookForEvent(entries: HookEntry[] | undefined, eventName: string): boolean {
  if (!entries) return false;
  return entries.some((entry) => entry.hooks.some((h) => isCcmHookCommand(h.command, eventName)));
}

/**
 * Check if ccm command is in PATH and return the appropriate command
 */
function getCcmCommand(): string {
  const result = spawnSync('which', ['ccm'], { encoding: 'utf-8' });
  if (result.status === 0) {
    return 'ccm';
  }
  return `npx ${PACKAGE_NAME}`;
}

/**
 * Check if Ghostty is installed
 * @internal
 */
export function isGhosttyInstalled(): boolean {
  // Check if Ghostty.app exists
  if (existsSync('/Applications/Ghostty.app')) {
    return true;
  }
  // Check if ghostty command is in PATH
  const result = spawnSync('which', ['ghostty'], { encoding: 'utf-8' });
  return result.status === 0;
}

/**
 * Check if the terminal title disable env is already configured
 * @internal
 */
export function hasDisableTitleEnv(settings: Settings): boolean {
  return settings.env?.[DISABLE_TITLE_ENV_KEY] === '1';
}

/**
 * Apply the disable title environment variable to settings
 * @internal
 */
function applyDisableTitleEnv(settings: Settings): void {
  if (!settings.env) {
    settings.env = {};
  }
  settings.env[DISABLE_TITLE_ENV_KEY] = '1';
}

/**
 * Create a hook entry for the given event
 * @internal
 */
export function createHookEntry(eventName: string, baseCommand: string): HookEntry {
  const entry: HookEntry = {
    hooks: [
      {
        type: 'command',
        command: `${baseCommand} hook ${eventName}`,
      },
    ],
  };
  // Events other than UserPromptSubmit require a matcher
  if (eventName !== 'UserPromptSubmit') {
    entry.matcher = '';
  }
  return entry;
}

/**
 * Load existing settings.json or return empty settings
 */
function loadSettings(): Settings {
  if (!existsSync(SETTINGS_FILE)) {
    return {};
  }
  try {
    const content = readFileSync(SETTINGS_FILE, 'utf-8');
    return JSON.parse(content) as Settings;
  } catch {
    console.error('Warning: Failed to parse existing settings.json, creating new one');
    return {};
  }
}

/**
 * Determine which hooks need to be added or skipped
 * @internal
 */
export function categorizeHooks(settings: Settings): { toAdd: string[]; toSkip: string[] } {
  const toAdd: string[] = [];
  const toSkip: string[] = [];

  for (const eventName of HOOK_EVENTS) {
    if (hasCcmHookForEvent(settings.hooks?.[eventName], eventName)) {
      toSkip.push(eventName);
    } else {
      toAdd.push(eventName);
    }
  }

  return { toAdd, toSkip };
}

/**
 * Display setup preview to the user
 */
function showSetupPreview(
  hooksToAdd: string[],
  hooksToSkip: string[],
  settingsExist: boolean
): void {
  console.log(`Target file: ${SETTINGS_FILE}`);
  console.log(settingsExist ? '(file exists, will be modified)' : '(file will be created)');
  console.log('');
  console.log('The following hooks will be added:');
  for (const eventName of hooksToAdd) {
    console.log(`  [add]  ${eventName}`);
  }
  if (hooksToSkip.length > 0) {
    console.log('');
    console.log('Already configured (will be skipped):');
    for (const eventName of hooksToSkip) {
      console.log(`  [skip] ${eventName}`);
    }
  }
  console.log('');
}

/**
 * Apply hooks to settings and save to file
 */
function applyHooks(settings: Settings, hooksToAdd: string[], baseCommand: string): void {
  if (!settings.hooks) {
    settings.hooks = {};
  }

  for (const eventName of hooksToAdd) {
    const existing = settings.hooks[eventName];
    if (!existing) {
      settings.hooks[eventName] = [createHookEntry(eventName, baseCommand)];
    } else {
      existing.push(createHookEntry(eventName, baseCommand));
    }
  }

  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });
}

/**
 * Check if hooks are already configured
 */
export function isHooksConfigured(): boolean {
  if (!existsSync(SETTINGS_FILE)) {
    return false;
  }

  try {
    const content = readFileSync(SETTINGS_FILE, 'utf-8');
    const settings = JSON.parse(content) as Settings;

    if (!settings.hooks) {
      return false;
    }

    // Check if all hook events are configured
    for (const eventName of HOOK_EVENTS) {
      if (!hasCcmHookForEvent(settings.hooks[eventName], eventName)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

export async function setupHooks(): Promise<void> {
  console.log('Claude Code Monitor Setup');
  console.log('=========================');
  console.log('');

  const baseCommand = getCcmCommand();
  console.log(`Using command: ${baseCommand}`);
  console.log('');

  // Ensure .claude directory exists
  if (!existsSync(CLAUDE_DIR)) {
    mkdirSync(CLAUDE_DIR, { recursive: true });
  }

  const settingsExist = existsSync(SETTINGS_FILE);
  const settings = loadSettings();
  const { toAdd: hooksToAdd, toSkip: hooksToSkip } = categorizeHooks(settings);

  // Check for Ghostty and terminal title env
  const ghosttyInstalled = isGhosttyInstalled();
  const needsDisableTitleEnv = ghosttyInstalled && !hasDisableTitleEnv(settings);

  // No changes needed
  if (hooksToAdd.length === 0 && !needsDisableTitleEnv) {
    console.log('All hooks already configured. No changes needed.');
    console.log('');
    console.log(`Start monitoring with: ${baseCommand} watch`);
    return;
  }

  // Show hook setup preview
  if (hooksToAdd.length > 0) {
    showSetupPreview(hooksToAdd, hooksToSkip, settingsExist);
  }

  // Show Ghostty-specific setup
  if (needsDisableTitleEnv) {
    console.log('Ghostty detected:');
    console.log('  [add]  env.CLAUDE_CODE_DISABLE_TERMINAL_TITLE = "1"');
    console.log('         (Required for reliable tab focus in Ghostty)');
    console.log('');
  }

  const confirmed = await askConfirmation('Do you want to apply these changes?');
  if (!confirmed) {
    console.log('');
    console.log('Setup cancelled. No changes were made.');
    return;
  }

  // Apply hooks
  if (hooksToAdd.length > 0) {
    applyHooks(settings, hooksToAdd, baseCommand);
  }

  // Apply Ghostty env setting
  if (needsDisableTitleEnv) {
    applyDisableTitleEnv(settings);
    writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });
  }

  const totalChanges = hooksToAdd.length + (needsDisableTitleEnv ? 1 : 0);
  console.log('');
  console.log(`Setup complete! Applied ${totalChanges} change(s) to ${SETTINGS_FILE}`);
  console.log('');
  console.log(`Start monitoring with: ${baseCommand} watch`);
}
