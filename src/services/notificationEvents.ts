// A tiny app-level signal so the header bell and the inbox page stay in sync.
//
// The bell polls the unread count, but a "Mark all as read" on the inbox (or a
// mark-read on a single row) must update the badge immediately rather than
// waiting for the next poll. Rather than lifting notification state into a
// context (and re-rendering the whole app on every poll), the two surfaces share
// this one subscription: whoever changes read state emits, and the bell refetches.
type Listener = () => void;

const listeners = new Set<Listener>();

export function onNotificationsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitNotificationsChanged(): void {
  for (const listener of listeners) listener();
}
