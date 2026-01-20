import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import chokidar from 'chokidar';
import qrcode from 'qrcode-terminal';
import { type WebSocket, WebSocketServer } from 'ws';
import { getSessions, getStorePath } from '../store/file-store.js';
import type { Session } from '../types/index.js';
import { focusSession } from '../utils/focus.js';
import { sendTextToTerminal } from '../utils/send-text.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Generate a random authentication token.
 */
function generateAuthToken(): string {
  return randomBytes(32).toString('hex');
}

interface WebSocketMessage {
  type: 'sessions' | 'focus' | 'sendText';
  sessionId?: string;
  text?: string;
}

interface BroadcastMessage {
  type: 'sessions';
  data: Session[];
}

// WebSocket.OPEN constant (avoid magic number)
const WEBSOCKET_OPEN = 1;

/**
 * Find a session by session ID.
 */
function findSessionById(sessionId: string): Session | undefined {
  const sessions = getSessions();
  return sessions.find((s) => s.session_id === sessionId);
}

/**
 * Handle focus command from WebSocket client.
 */
function handleFocusCommand(ws: WebSocket, sessionId: string): void {
  const session = findSessionById(sessionId);
  if (!session?.tty) {
    ws.send(
      JSON.stringify({
        type: 'focusResult',
        success: false,
        error: 'Session not found or no TTY',
      })
    );
    return;
  }
  const success = focusSession(session.tty);
  ws.send(JSON.stringify({ type: 'focusResult', success }));
}

/**
 * Handle sendText command from WebSocket client.
 */
function handleSendTextCommand(ws: WebSocket, sessionId: string, text: string): void {
  const session = findSessionById(sessionId);
  if (!session?.tty) {
    ws.send(JSON.stringify({ type: 'sendTextResult', success: false, error: 'Session not found' }));
    return;
  }
  const result = sendTextToTerminal(session.tty, text);
  ws.send(JSON.stringify({ type: 'sendTextResult', ...result }));
}

/**
 * Handle incoming WebSocket message from client.
 * Processes focus and sendText commands.
 */
function handleWebSocketMessage(ws: WebSocket, data: Buffer): void {
  let message: WebSocketMessage;
  try {
    message = JSON.parse(data.toString()) as WebSocketMessage;
  } catch {
    return; // Ignore invalid messages
  }

  if (message.type === 'focus' && message.sessionId) {
    handleFocusCommand(ws, message.sessionId);
    return;
  }

  if (message.type === 'sendText' && message.sessionId && message.text) {
    handleSendTextCommand(ws, message.sessionId, message.text);
  }
}

/**
 * Broadcast message to all connected WebSocket clients.
 */
function broadcastToClients(wss: WebSocketServer, message: BroadcastMessage): void {
  const data = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WEBSOCKET_OPEN) {
      client.send(data);
    }
  }
}

/**
 * Send current sessions to a WebSocket client.
 */
function sendSessionsToClient(ws: WebSocket): void {
  const sessions = getSessions();
  ws.send(JSON.stringify({ type: 'sessions', data: sessions }));
}

/**
 * Setup WebSocket connection handlers.
 */
function setupWebSocketHandlers(wss: WebSocketServer, validToken: string): void {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '/', `ws://${req.headers.host}`);
    const requestToken = url.searchParams.get('token');

    if (requestToken !== validToken) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    sendSessionsToClient(ws);
    ws.on('message', (data: Buffer) => handleWebSocketMessage(ws, data));
  });
}

export interface ServerInfo {
  url: string;
  qrCode: string;
  token: string;
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

function serveStatic(req: IncomingMessage, res: ServerResponse, validToken: string): void {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const requestToken = url.searchParams.get('token');

  if (requestToken !== validToken) {
    res.writeHead(401, { 'Content-Type': 'text/plain' });
    res.end('Unauthorized - Invalid or missing token');
    return;
  }

  const publicDir = join(__dirname, '../../public');
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;

  // Prevent directory traversal
  filePath = filePath.replace(/\.\./g, '');

  const fullPath = join(publicDir, filePath);

  try {
    const content = readFileSync(fullPath, 'utf-8');
    res.writeHead(200, {
      'Content-Type': getContentType(filePath),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not Found');
  }
}

interface ServerComponents {
  server: ReturnType<typeof createServer>;
  wss: WebSocketServer;
  watcher: ReturnType<typeof chokidar.watch>;
}

/**
 * Create server components (HTTP server, WebSocket server, file watcher).
 * Shared by createMobileServer and startServer.
 */
function createServerComponents(token: string): ServerComponents {
  const server = createServer((req, res) => serveStatic(req, res, token));
  const wss = new WebSocketServer({ server });
  setupWebSocketHandlers(wss, token);

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
    broadcastToClients(wss, { type: 'sessions', data: sessions });
  });

  return { server, wss, watcher };
}

/**
 * Stop all server components.
 */
function stopServerComponents({ watcher, wss, server }: ServerComponents): void {
  watcher.close();
  wss.close();
  server.close();
}

export async function createMobileServer(port = 3456): Promise<ServerInfo> {
  const localIP = getLocalIP();
  const token = generateAuthToken();
  const url = `http://${localIP}:${port}?token=${token}`;
  const qrCode = await generateQRCode(url);

  const components = createServerComponents(token);

  await new Promise<void>((resolve) => {
    components.server.listen(port, '0.0.0.0', resolve);
  });

  return {
    url,
    qrCode,
    token,
    stop: () => stopServerComponents(components),
  };
}

// CLI standalone mode
export function startServer(port = 3456): void {
  const localIP = getLocalIP();
  const token = generateAuthToken();
  const url = `http://${localIP}:${port}?token=${token}`;

  const components = createServerComponents(token);

  components.server.listen(port, '0.0.0.0', () => {
    console.log('\n  Claude Code Monitor - Mobile Web Interface\n');
    console.log(`  Server running at: ${url}\n`);
    console.log('  Scan this QR code with your phone:\n');
    qrcode.generate(url, { small: true });
    console.log('\n  Press Ctrl+C to stop the server.\n');
  });

  process.on('SIGINT', () => {
    console.log('\n  Shutting down...');
    stopServerComponents(components);
    process.exit(0);
  });
}
