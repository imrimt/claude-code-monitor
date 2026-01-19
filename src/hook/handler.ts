import { flushPendingWrites, updateSession } from '../store/file-store.js';
import type { HookEvent, HookEventName } from '../types/index.js';
import { buildTranscriptPath } from '../utils/transcript.js';

// Allowed hook event names (whitelist)
/** @internal */
export const VALID_HOOK_EVENTS: ReadonlySet<string> = new Set<HookEventName>([
  'PreToolUse',
  'PostToolUse',
  'Notification',
  'Stop',
  'UserPromptSubmit',
]);

/** @internal */
export function isValidHookEventName(name: string): name is HookEventName {
  return VALID_HOOK_EVENTS.has(name);
}

/** @internal */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export async function handleHookEvent(eventName: string, tty?: string): Promise<void> {
  // Validate event name against whitelist
  if (!isValidHookEventName(eventName)) {
    console.error(`Invalid event name: ${eventName}`);
    process.exit(1);
  }

  // Read JSON from stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const inputJson = Buffer.concat(chunks).toString('utf-8');

  let hookPayload: Record<string, unknown>;
  try {
    hookPayload = JSON.parse(inputJson);
  } catch {
    console.error('Invalid JSON input');
    process.exit(1);
  }

  // Validate required fields
  if (!isNonEmptyString(hookPayload.session_id)) {
    console.error('Invalid or missing session_id');
    process.exit(1);
  }

  // Validate optional fields if present
  if (hookPayload.cwd !== undefined && typeof hookPayload.cwd !== 'string') {
    console.error('Invalid cwd: must be a string');
    process.exit(1);
  }

  if (
    hookPayload.notification_type !== undefined &&
    typeof hookPayload.notification_type !== 'string'
  ) {
    console.error('Invalid notification_type: must be a string');
    process.exit(1);
  }

  // Get transcript_path: use provided path or build from cwd and session_id
  const cwd = (hookPayload.cwd as string) || process.cwd();
  const transcriptPath =
    typeof hookPayload.transcript_path === 'string'
      ? hookPayload.transcript_path
      : buildTranscriptPath(cwd, hookPayload.session_id);

  const event: HookEvent = {
    session_id: hookPayload.session_id,
    cwd,
    tty,
    hook_event_name: eventName,
    notification_type: hookPayload.notification_type as string | undefined,
    transcript_path: transcriptPath,
  };

  updateSession(event);

  // Ensure data is written before process exits (hooks are short-lived processes)
  flushPendingWrites();
}
