import { EventEmitter } from 'events';
import type { SSEEventType } from '@social-pulse/shared';

/**
 * In-memory SSE event emitter keyed by analysisId.
 * Clients subscribe and receive events until done/failed.
 */
class SSEEmitter extends EventEmitter {
  private analysisListeners = new Map<string, Set<(event: SSEPayload) => void>>();

  emit(analysisId: string, event: SSEPayload): boolean {
    const listeners = this.analysisListeners.get(analysisId);
    if (listeners) {
      listeners.forEach((fn) => fn(event));
    }
    return true;
  }

  subscribe(analysisId: string, listener: (event: SSEPayload) => void): () => void {
    if (!this.analysisListeners.has(analysisId)) {
      this.analysisListeners.set(analysisId, new Set());
    }
    this.analysisListeners.get(analysisId)!.add(listener);

    return () => {
      const set = this.analysisListeners.get(analysisId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.analysisListeners.delete(analysisId);
        }
      }
    };
  }

  cleanup(analysisId: string): void {
    this.analysisListeners.delete(analysisId);
  }
}

export interface SSEPayload {
  type: SSEEventType;
  analysisId: string;
  data: unknown;
}

export const sseEmitter = new SSEEmitter();
