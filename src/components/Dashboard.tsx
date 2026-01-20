import { Box, Text, useApp, useInput } from 'ink';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useServer } from '../hooks/useServer.js';
import { useSessions } from '../hooks/useSessions.js';
import { clearSessions, readSettings, writeSettings } from '../store/file-store.js';
import { focusSession } from '../utils/focus.js';
import { SessionCard } from './SessionCard.js';

const QUICK_SELECT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function Dashboard(): React.ReactElement {
  const { sessions, loading, error } = useSessions();
  const { url, qrCode, loading: serverLoading } = useServer();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { exit } = useApp();

  // ユーザー設定からQRコード表示状態を読み込む（初回は表示）
  const [qrCodeVisible, setQrCodeVisible] = useState(() => readSettings().qrCodeVisible);

  const toggleQrCode = () => {
    const newValue = !qrCodeVisible;
    setQrCodeVisible(newValue);
    writeSettings({ qrCodeVisible: newValue });
  };

  const focusSessionByIndex = (index: number) => {
    const session = sessions[index];
    if (session?.tty) {
      focusSession(session.tty);
    }
  };

  const handleQuickSelect = (input: string) => {
    const index = parseInt(input, 10) - 1;
    if (index < sessions.length) {
      setSelectedIndex(index);
      focusSessionByIndex(index);
    }
  };

  const statusCounts = useMemo(
    () =>
      sessions.reduce(
        (counts, session) => {
          counts[session.status]++;
          return counts;
        },
        { running: 0, waiting_input: 0, stopped: 0 }
      ),
    [sessions]
  );

  useInput((input, key) => {
    if (input === 'q' || key.escape) {
      exit();
      return;
    }
    if (key.upArrow || input === 'k') {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow || input === 'j') {
      setSelectedIndex((prev) => Math.min(sessions.length - 1, prev + 1));
      return;
    }
    if (key.return || input === 'f') {
      focusSessionByIndex(selectedIndex);
      return;
    }
    if (QUICK_SELECT_KEYS.includes(input)) {
      handleQuickSelect(input);
      return;
    }
    if (input === 'c') {
      clearSessions();
      setSelectedIndex(0);
      return;
    }
    if (input === 'h') {
      toggleQrCode();
      return;
    }
  });

  if (loading) {
    return <Text dimColor>Loading...</Text>;
  }

  if (error) {
    return <Text color="red">Error: {error.message}</Text>;
  }

  const { running, waiting_input: waitingInput, stopped } = statusCounts;

  return (
    <Box flexDirection="column">
      {/* Main Panel: Header + Sessions */}
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
        {/* Header */}
        <Box>
          <Text bold color="cyan">
            Claude Code Monitor
          </Text>
          <Text dimColor> </Text>
          <Text color="gray">● {running}</Text>
          <Text dimColor> </Text>
          <Text color="yellow">◐ {waitingInput}</Text>
          <Text dimColor> </Text>
          <Text color="green">✓ {stopped}</Text>
        </Box>

        {/* Sessions */}
        <Box flexDirection="column" marginTop={1}>
          {sessions.length === 0 ? (
            <Box>
              <Text dimColor>No active sessions</Text>
            </Box>
          ) : (
            sessions.map((session, index) => (
              <SessionCard
                key={`${session.session_id}:${session.tty || ''}`}
                session={session}
                index={index}
                isSelected={index === selectedIndex}
              />
            ))
          )}
        </Box>
      </Box>

      {/* Keyboard Shortcuts */}
      <Box marginTop={1} justifyContent="center" gap={1}>
        <Text dimColor>[↑↓]Select</Text>
        <Text dimColor>[Enter]Focus</Text>
        <Text dimColor>[1-9]Quick</Text>
        <Text dimColor>[c]Clear</Text>
        <Text dimColor>[q]Quit</Text>
      </Box>

      {/* Web UI */}
      {!serverLoading && url && (
        <Box marginTop={1} paddingX={1}>
          {qrCodeVisible && qrCode && (
            <Box flexShrink={0}>
              <Text>{qrCode}</Text>
            </Box>
          )}
          <Box
            flexDirection="column"
            marginLeft={qrCodeVisible && qrCode ? 2 : 0}
            justifyContent="center"
          >
            <Text bold color="magenta">
              Web UI
            </Text>
            <Text dimColor>{url}</Text>
            <Text dimColor>Scan QR code to monitor sessions from your phone.</Text>
            <Text dimColor>Tap a session to focus its terminal on this Mac.</Text>
            <Text dimColor>[h] {qrCodeVisible ? 'Hide' : 'Show'} QR code</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
