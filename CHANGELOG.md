# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
