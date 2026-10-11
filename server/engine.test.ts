import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState, planStatus, processMessage } from './engine.js';
test('a repair requires two confirmations; withdrawal reopens it', () => {
  const s = freshState();
  processMessage(s, { text: 'donor', session: 'a', channel: 'imessage' });
  assert.equal(s.donor, false);
  processMessage(s, { text: 'yes', session: 'a', channel: 'imessage' });
  assert.equal(planStatus(s), 'assembling');
  processMessage(s, { text: 'repairer', session: 'b', channel: 'imessage' });
  processMessage(s, { text: 'yes', session: 'b', channel: 'imessage' });
  assert.equal(planStatus(s), 'ready');
  processMessage(s, { text: 'cancel', session: 'a', channel: 'imessage' });
  assert.equal(planStatus(s), 'assembling');
  assert.equal(s.donor, false);
});
test('unknown senders cannot confirm and duplicate events are ignored', () => {
  const s = freshState();
  processMessage(s, { text: 'yes', session: 'unknown', channel: 'imessage' });
  assert.equal(s.donor, false);
  const input = { text: 'donor', session: 'a', channel: 'imessage' as const, messageId: 'same' };
  processMessage(s, input);
  const count = s.messages.length;
  assert.equal(processMessage(s, input), null);
  assert.equal(s.messages.length, count);
});
