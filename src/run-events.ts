import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';

export type RunEventType =
  | 'status'
  | 'step'
  | 'task'
  | 'command'
  | 'file'
  | 'log'
  | 'error';

export interface RunEvent {
  id: string;
  runId: string;
  type: RunEventType;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

const emitter = new EventEmitter();
const eventsByRun = new Map<string, RunEvent[]>();
const MAX_EVENTS = 200;

export function emitRunEvent(
  runId: string,
  event: Omit<RunEvent, 'id' | 'runId' | 'timestamp'> & { timestamp?: string }
): RunEvent {
  const fullEvent: RunEvent = {
    id: nanoid(10),
    runId,
    timestamp: event.timestamp || new Date().toISOString(),
    type: event.type,
    message: event.message,
    data: event.data
  };

  const list = eventsByRun.get(runId) || [];
  list.push(fullEvent);
  if (list.length > MAX_EVENTS) {
    list.shift();
  }
  eventsByRun.set(runId, list);

  emitter.emit(runId, fullEvent);
  return fullEvent;
}

export function getRunEvents(runId: string): RunEvent[] {
  return eventsByRun.get(runId) || [];
}

export function clearRunEvents(runId: string): void {
  eventsByRun.delete(runId);
}

export function onRunEvent(
  runId: string,
  listener: (event: RunEvent) => void
): () => void {
  emitter.on(runId, listener);
  return () => emitter.off(runId, listener);
}
