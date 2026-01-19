import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Build transcript file path from cwd and session_id.
 * Claude Code stores transcripts at ~/.claude/projects/{encoded-cwd}/{session_id}.jsonl
 */
export function buildTranscriptPath(cwd: string, sessionId: string): string {
  // Encode cwd: replace / and . with - (including leading /)
  const encodedCwd = cwd.replace(/[/.]/g, '-');
  return join(homedir(), '.claude', 'projects', encodedCwd, `${sessionId}.jsonl`);
}

/**
 * Get the last assistant message from a transcript file.
 */
export function getLastAssistantMessage(transcriptPath: string): string | undefined {
  if (!transcriptPath || !existsSync(transcriptPath)) {
    return undefined;
  }

  try {
    const content = readFileSync(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    // Read from end to find last assistant message
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.type === 'assistant' && entry.message?.content) {
          // Extract text from content array
          const textParts = entry.message.content
            .filter((c: { type: string }) => c.type === 'text')
            .map((c: { text: string }) => c.text)
            .join('\n');
          if (textParts) {
            return textParts;
          }
        }
      } catch {
        // Skip invalid JSON lines
      }
    }
  } catch {
    // Ignore file read errors
  }

  return undefined;
}
