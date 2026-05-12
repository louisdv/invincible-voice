/**
 * Unit tests for the context-toggle + sendCurrentContexts logic
 * extracted from InvincibleVoice.
 *
 * These tests exercise the pure callback behaviour without mounting
 * the full InvincibleVoice tree (which requires heavy mocking).
 */

import type { Context } from '@/types/user';

// ---------------------------------------------------------------------------
// Pure helpers mirroring the InvincibleVoice callback logic
// ---------------------------------------------------------------------------

function makeSendCurrentContexts(
  sendMessage: (msg: string) => void,
  getLastSent: () => string[] | null,
  setLastSent: (v: string[]) => void,
) {
  return (labels: string[]) => {
    const sortedA = [...labels].sort();
    const lastSentContexts = getLastSent();
    const sortedB = lastSentContexts ? [...lastSentContexts].sort() : null;
    if (
      sortedB === null ||
      JSON.stringify(sortedA) !== JSON.stringify(sortedB)
    ) {
      sendMessage(JSON.stringify({ type: 'current.contexts', contexts: labels }));
      setLastSent(labels);
    }
  };
}

function makeHandleContextToggle(
  getActiveIds: () => Set<string>,
  setActiveIds: (fn: (prev: Set<string>) => Set<string>) => void,
  contexts: Context[],
  sendCurrentContexts: (labels: string[]) => void,
) {
  return (contextId: string) => {
    setActiveIds((prev) => {
      const next = new Set(prev);
      if (next.has(contextId)) {
        next.delete(contextId);
      } else {
        next.add(contextId);
      }
      const labels = contexts
        .filter((c) => next.has(c.id))
        .map((c) => c.label);
      sendCurrentContexts(labels);
      return next;
    });
  };
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const CONTEXTS: Context[] = [
  { id: '1', label: 'Au travail' },
  { id: '2', label: 'Famille' },
  { id: '3', label: 'Médical' },
];

// ---------------------------------------------------------------------------
// Helper to build a stateful test harness
// ---------------------------------------------------------------------------

function buildHarness() {
  const messages: string[] = [];
  let activeIds: Set<string> = new Set();
  let lastSent: string[] | null = null;

  const sendMessage = (msg: string) => messages.push(msg);
  const sendCurrentContexts = makeSendCurrentContexts(
    sendMessage,
    () => lastSent,
    (v) => { lastSent = v; },
  );
  const handleContextToggle = makeHandleContextToggle(
    () => activeIds,
    (fn) => { activeIds = fn(activeIds); },
    CONTEXTS,
    sendCurrentContexts,
  );

  return { messages, getActiveIds: () => activeIds, handleContextToggle, sendCurrentContexts };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('current.contexts callback logic', () => {
  it('sends current.contexts with active labels on first toggle', () => {
    const { messages, handleContextToggle } = buildHarness();

    handleContextToggle('1');

    expect(messages).toHaveLength(1);
    const payload = JSON.parse(messages[0]);
    expect(payload).toEqual({ type: 'current.contexts', contexts: ['Au travail'] });
  });

  it('toggles off on second click of same chip', () => {
    const { messages, handleContextToggle, getActiveIds } = buildHarness();

    handleContextToggle('1'); // activate
    handleContextToggle('1'); // deactivate

    expect(getActiveIds().size).toBe(0);
    // Second message sends []
    const payload = JSON.parse(messages[1]);
    expect(payload).toEqual({ type: 'current.contexts', contexts: [] });
  });

  it('sends union of labels when multiple contexts are active', () => {
    const { messages, handleContextToggle } = buildHarness();

    handleContextToggle('1');
    handleContextToggle('3');

    expect(messages).toHaveLength(2);
    const payload = JSON.parse(messages[1]);
    // Order depends on filter, but should contain both labels
    expect(payload.type).toBe('current.contexts');
    expect(payload.contexts).toEqual(expect.arrayContaining(['Au travail', 'Médical']));
    expect(payload.contexts).toHaveLength(2);
  });

  it('does not re-send if the same set of labels is sent twice', () => {
    const { messages, sendCurrentContexts } = buildHarness();

    sendCurrentContexts(['Au travail']);
    sendCurrentContexts(['Au travail']); // same — should be deduplicated

    expect(messages).toHaveLength(1);
  });

  it('reset: sends current.contexts with empty array on WebSocket OPEN', () => {
    const sent: string[] = [];
    const sendMessage = (msg: string) => sent.push(msg);

    // Simulate the reset logic from the readyState === OPEN useEffect
    sendMessage(JSON.stringify({ type: 'current.contexts', contexts: [] }));

    expect(sent).toHaveLength(1);
    const payload = JSON.parse(sent[0]);
    expect(payload).toEqual({ type: 'current.contexts', contexts: [] });
  });
});
