import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FSWatcher } from 'chokidar';
import chokidar from 'chokidar';
import qrcode from 'qrcode-terminal';
import { type WebSocket, WebSocketServer } from 'ws';
import { getSessions, getStorePath } from '../store/file-store.js';
import type { Session } from '../types/index.js';
import { focusSession } from '../utils/focus.js';
import { sendTextToTerminal } from '../utils/send-text.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface WebSocketMessage {
  type: 'sessions' | 'focus' | 'sendText';
  sessionId?: string;
  text?: string;
}

interface BroadcastMessage {
  type: 'sessions';
  data: Session[];
}

export interface ServerInfo {
  url: string;
  qrCode: string;
  stop: () => void;
}

export function getLocalIP(): string {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const info of iface) {
      if (info.family === 'IPv4' && !info.internal) {
        return info.address;
      }
    }
  }
  return 'localhost';
}

export function generateQRCode(text: string): Promise<string> {
  return new Promise((resolve) => {
    qrcode.generate(text, { small: true }, (qrCode: string) => {
      resolve(qrCode);
    });
  });
}

function getContentType(path: string): string {
  if (path.endsWith('.html')) return 'text/html';
  if (path.endsWith('.css')) return 'text/css';
  if (path.endsWith('.js')) return 'application/javascript';
  return 'text/plain';
}

function serveStatic(req: IncomingMessage, res: ServerResponse): void {
  const publicDir = join(__dirname, '../../public');
  let filePath = req.url === '/' ? '/index.html' : req.url || '/index.html';

  // Prevent directory traversal
  filePath = filePath.replace(/\.\./g, '');

  const fullPath = join(publicDir, filePath);

  try {
    const content = readFileSync(fullPath, 'utf-8');
    res.writeHead(200, { 'Content-Type': getContentType(filePath) });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not Found');
  }
}

export async function createMobileServer(port = 3456): Promise<ServerInfo> {
  const localIP = getLocalIP();
  const url = `http://${localIP}:${port}`;

  // Generate QR code
  const qrCode = await generateQRCode(url);

  // HTTP server for static files
  const server = createServer(serveStatic);

  // WebSocket server
  const wss = new WebSocketServer({ server });

  function broadcast(message: BroadcastMessage): void {
    const data = JSON.stringify(message);
    for (const client of wss.clients) {
      if (client.readyState === 1) {
        // WebSocket.OPEN
        client.send(data);
      }
    }
  }

  function sendSessions(ws: WebSocket): void {
    const sessions = getSessions();
    ws.send(JSON.stringify({ type: 'sessions', data: sessions }));
  }

  wss.on('connection', (ws: WebSocket) => {
    // Send initial sessions
    sendSessions(ws);

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage;

        if (message.type === 'focus' && message.sessionId) {
          // Find session by ID and focus
          const sessions = getSessions();
          const session = sessions.find((s) => s.session_id === message.sessionId);
          if (session?.tty) {
            const success = focusSession(session.tty);
            ws.send(JSON.stringify({ type: 'focusResult', success }));
          }
        } else if (message.type === 'sendText' && message.sessionId && message.text) {
          // Find session by ID and send text
          const sessions = getSessions();
          const session = sessions.find((s) => s.session_id === message.sessionId);
          if (session?.tty) {
            const result = sendTextToTerminal(session.tty, message.text);
            ws.send(JSON.stringify({ type: 'sendTextResult', ...result }));
          } else {
            ws.send(
              JSON.stringify({ type: 'sendTextResult', success: false, error: 'Session not found' })
            );
          }
        }
      } catch {
        // Ignore invalid messages
      }
    });
  });

  // Watch sessions.json for changes
  const storePath = getStorePath();
  const watcher = chokidar.watch(storePath, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  watcher.on('change', () => {
    const sessions = getSessions();
    broadcast({ type: 'sessions', data: sessions });
  });

  // Start server
  await new Promise<void>((resolve) => {
    server.listen(port, '0.0.0.0', resolve);
  });

  // Return server info with stop function
  const stop = () => {
    watcher.close();
    wss.close();
    server.close();
  };

  return { url, qrCode, stop };
}

// CLI standalone mode
export function startServer(port = 3456): void {
  const localIP = getLocalIP();
  const url = `http://${localIP}:${port}`;

  // HTTP server for static files
  const server = createServer(serveStatic);

  // WebSocket server
  const wss = new WebSocketServer({ server });

  let watcher: FSWatcher;

  function broadcast(message: BroadcastMessage): void {
    const data = JSON.stringify(message);
    for (const client of wss.clients) {
      if (client.readyState === 1) {
        client.send(data);
      }
    }
  }

  function sendSessions(ws: WebSocket): void {
    const sessions = getSessions();
    ws.send(JSON.stringify({ type: 'sessions', data: sessions }));
  }

  wss.on('connection', (ws: WebSocket) => {
    sendSessions(ws);

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage;

        if (message.type === 'focus' && message.sessionId) {
          const sessions = getSessions();
          const session = sessions.find((s) => s.session_id === message.sessionId);
          if (session?.tty) {
            const success = focusSession(session.tty);
            ws.send(JSON.stringify({ type: 'focusResult', success }));
          }
        } else if (message.type === 'sendText' && message.sessionId && message.text) {
          const sessions = getSessions();
          const session = sessions.find((s) => s.session_id === message.sessionId);
          if (session?.tty) {
            const result = sendTextToTerminal(session.tty, message.text);
            ws.send(JSON.stringify({ type: 'sendTextResult', ...result }));
          } else {
            ws.send(
              JSON.stringify({ type: 'sendTextResult', success: false, error: 'Session not found' })
            );
          }
        }
      } catch {
        // Ignore invalid messages
      }
    });
  });

  const storePath = getStorePath();
  watcher = chokidar.watch(storePath, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  watcher.on('change', () => {
    const sessions = getSessions();
    broadcast({ type: 'sessions', data: sessions });
  });

  server.listen(port, '0.0.0.0', () => {
    console.log('\n  Claude Code Monitor - Mobile Web Interface\n');
    console.log(`  Server running at: ${url}\n`);
    console.log('  Scan this QR code with your phone:\n');
    qrcode.generate(url, { small: true });
    console.log('\n  Press Ctrl+C to stop the server.\n');
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n  Shutting down...');
    watcher.close();
    wss.close();
    server.close();
    process.exit(0);
  });
}
