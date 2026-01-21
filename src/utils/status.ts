import type { SessionStatus } from '../types/index.js';

export interface StatusDisplay {
  symbol: string;
  color: string;
  label: string;
}

export function getStatusDisplay(status: SessionStatus): StatusDisplay {
  switch (status) {
    case 'running':
      return { symbol: '●', color: 'gray', label: 'Running' };
    case 'waiting_input':
      return { symbol: '◐', color: 'yellow', label: 'Waiting' };
    case 'stopped':
      return { symbol: '✓', color: 'green', label: 'Done' };
  }
}
