# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.2] - 2026-01-22

### Security

- Fix XSS vulnerabilities in mobile web UI
  - Add `escapeHtml()` for all user-provided content
  - Add `isValidSessionId()` validation
  - Replace inline onclick with event delegation pattern
- Enhance AppleScript sanitization (escape `$` and backtick characters)

### Fixed

- Add WebSocket client error handler to prevent process crashes
- Fix race condition in useServer hook when component unmounts during async operation
- Close net server on port availability check error

### Changed

- Add SIGTERM handler for graceful shutdown in containerized environments (Docker/K8s)
- Terminate all WebSocket clients explicitly before server shutdown

## [1.1.1] - 2026-01-22

### Changed

- Documentation improvements (README, CLAUDE.md)

## [1.1.0] - 2026-01-22

### Added

- **Mobile Web Interface** - Monitor and control sessions from your smartphone
  - Real-time session status via WebSocket
  - View latest Claude messages with markdown rendering
  - Focus terminal sessions remotely
  - Send text messages to terminal (multi-line supported)
  - Permission prompt responses (y/n/a) and Ctrl+C support
  - Bottom sheet modal with swipe-to-close gesture
- New command: `ccm serve` - Start mobile web server only
- QR code display in terminal UI (press `h` to toggle)
- Token-based authentication for mobile access
- Auto-select available port when default port (3456) is in use

### Changed

- Redesigned README with demo GIFs for both Terminal UI and Mobile Web
- Consolidated terminal fallback strategy for better code maintainability

### Security

- Mobile Web requires same Wi-Fi network (local network only)
- Unique token generated per session for authentication
- Warning messages about not sharing the access URL
- Dangerous command detection in mobile input

## [1.0.4] - 2026-01-18

### Fixed

- Use alternate screen buffer to prevent TUI stacking on re-render ([#5](https://github.com/onikan27/claude-code-monitor/pull/5)) by [@msdjzmst](https://github.com/msdjzmst)

## [1.0.3] - 2026-01-17

### Changed

- Update README: Add macOS-only badge and note, rename demo gif

## [1.0.2] - 2026-01-17

### Fixed

- Handle undefined cwd in session display (shows "(unknown)" instead of crashing)
- Ensure hook data is written before process exits

### Security

- Set file permission 0o600 for settings.json

## [1.0.1] - 2026-01-17

### Changed

- Improve performance with debounced file writes and session updates
- Add TTY cache size limit to prevent memory growth

## [1.0.0] - 2026-01-17

### Added

- Initial release
- Real-time monitoring of multiple Claude Code sessions
- Terminal UI (TUI) with keyboard navigation
- Focus feature to switch to session's terminal tab
  - Full support for iTerm2 and Terminal.app (TTY-based targeting)
  - Limited support for Ghostty (app activation only)
- Automatic hook setup via `ccm setup`
- Session status tracking (running, waiting for input, stopped)
- File-based session state management (no server required)
- Session auto-cleanup on timeout (30 minutes) or TTY termination
- Commands: `ccm`, `ccm watch`, `ccm setup`, `ccm list`, `ccm clear`
