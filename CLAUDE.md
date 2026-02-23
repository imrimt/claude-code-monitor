# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev           # Development mode (with hot reload)
npm run build         # TypeScript compilation
npm start             # Run compiled JS

# Tests
npm run test          # Run tests (single run)
npm run test:watch    # Run tests (watch mode)
npm run test:coverage # Run tests with coverage
npx vitest tests/handler.test.ts           # Run specific test file
npx vitest -t "updateSession"              # Filter by test name

# Code quality
npm run lint          # Lint check with Biome
npm run lint:fix      # Auto-fix lint issues
npm run format        # Code formatting
npm run typecheck     # Type checking only
```

### Testing Hook Events

```bash
# Test hook processing by passing JSON via stdin
echo '{"session_id":"test-123","cwd":"/tmp"}' | npx tsx src/bin/ccm.tsx hook PreToolUse
```

## Architecture

A macOS-only CLI tool for real-time monitoring of multiple Claude Code and Codex CLI sessions. Uses Ink (React for CLI) for the TUI and file-based state management.

### Key File Paths

- `~/.claude-monitor/sessions.json` - Persistent session state file
- `~/.claude/settings.json` - Claude Code hook configuration (auto-configured via `ccm setup`)
- `~/.claude/projects/*/TRANSCRIPT.md` - Conversation history for each session

### Data Flow

**Claude Code (via hooks)**:
1. **Hook received**: Claude Code fires hook events (PreToolUse, PostToolUse, Notification, Stop, UserPromptSubmit)
2. **State update**: `ccm hook <event>` reads JSON from stdin and updates `~/.claude-monitor/sessions.json`
3. **UI update**: chokidar detects file changes, Dashboard component re-renders
4. **Mobile Web sync**: Broadcasts session updates to connected WebSocket clients

**Codex CLI (via process scanning)**:
1. **Process detection**: Runs `ps` command every 5 seconds to detect `codex` processes
2. **CWD resolution**: Gets process working directory via `lsof`
3. **State sync**: `syncProcessSessions()` reflects detected results in the store (new → running, gone → removed)
4. **UI update**: chokidar detects store file changes and re-renders via the existing flow

### Directory Structure

- `src/bin/ccm.tsx` - CLI entry point (command definitions via Commander)
- `src/hook/handler.ts` - Hook event processing (stdin reading → state update)
- `src/store/file-store.ts` - Session state persistence (JSON read/write, TTY liveness check)
- `src/setup/index.ts` - Auto-configuration of hooks in `~/.claude/settings.json`
- `src/server/index.ts` - HTTP + WebSocket server (for mobile web)
- `src/components/` - Ink-based React components (Dashboard, SessionCard, Spinner)
- `src/hooks/useSessions.ts` - React hook with file change monitoring
- `src/hooks/useServer.ts` - Hook for starting the mobile server
- `src/hooks/useProcessScanner.ts` - Polling hook for Codex CLI process detection
- `src/utils/focus.ts` - Terminal focus via AppleScript
- `src/utils/status.ts` - Status display utility
- `src/utils/process-scanner.ts` - Codex CLI process detection (ps + lsof)
- `src/types/index.ts` - Type definitions (HookEvent, Session, SessionSource, SessionStatus, StoreData)
- `public/index.html` - Mobile Web UI (static HTML)

### Tech Stack

- **UI**: Ink v5 + React 18
- **CLI**: Commander
- **File watching**: chokidar
- **WebSocket**: ws
- **QR code generation**: qrcode-terminal
- **Terminal control**: AppleScript (iTerm2, Terminal.app, Ghostty)
- **Testing**: Vitest
- **Linting/Formatting**: Biome

### Session Management

Sessions are keyed as `session_id:tty`. When a new session starts on the same TTY, the old session is automatically removed.

Each session has a `source` field to identify its origin (`'claude-code'` | `'codex'`; unset defaults to claude-code).

**Claude Code state transitions**:
- `running`: Tool executing (transitions on PreToolUse, UserPromptSubmit)
- `waiting_input`: Waiting for permission approval (transitions on Notification + permission_prompt)
- `stopped`: Session ended (transitions on Stop)

**Codex CLI state transitions**:
- `running`: While the process is detected
- Removed from store when process exits (`waiting_input` not supported)
- Session ID format: `codex-{pid}`

Sessions are automatically removed when their TTY no longer exists.

### Mobile Web Interface

A web server starts automatically when running `ccm` or `ccm watch`, displaying a QR code in the Dashboard UI. Allows session monitoring and focus control from a smartphone.

- HTTP server: Serves `public/index.html` (default port 3456)
- WebSocket: Real-time session sync, receives focus commands
- `ccm serve` can also be used as a standalone web server mode

### Library Usage

```typescript
import { getSessions, getStatusDisplay, focusSession } from 'claude-code-monitor';
```

Public API is exported from `src/index.ts`.

### Test File Structure

- `tests/handler.test.ts` - Hook event processing tests
- `tests/file-store.test.ts` - Session state management tests
- `tests/focus.test.ts` - Terminal focus functionality tests
- `tests/send-text.test.ts` - Text sending functionality tests
- `tests/process-scanner.test.ts` - Codex process detection and sync tests
