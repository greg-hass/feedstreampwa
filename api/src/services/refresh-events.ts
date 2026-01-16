export type RefreshEventType = 'start' | 'progress' | 'complete' | 'error';

export interface RefreshEvent {
  type: RefreshEventType;
  jobId: string;
  current: number;
  total: number;
  message?: string;
  currentFeedTitle?: string;
  currentFeedUrl?: string;
  startedAt: number;
  lastSync?: number;
  source?: 'manual' | 'scheduler';
}

type Subscriber = (event: RefreshEvent) => void;

const subscribers = new Set<Subscriber>();

export function publishRefreshEvent(event: RefreshEvent): void {
  for (const subscriber of subscribers) {
    try {
      subscriber(event);
    } catch {
      // Ignore per-subscriber errors to keep the stream healthy.
    }
  }
}

export function subscribeRefreshEvents(subscriber: Subscriber): () => void {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}
